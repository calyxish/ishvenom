"""Export the trained vision classifier to TFLite INT8 for on-device inference.

Pipeline: PyTorch checkpoint → ONNX → TensorFlow SavedModel → TFLite INT8.
Target: < 20 MB on disk, runs on Tecno Spark-class ARM CPU via TFLite.

The ONNX → TF step uses `onnx-tf`. The TFLite quantization step runs a
representative-data pass using 200 images from the validation split so the
INT8 activation ranges are calibrated on realistic snake photos, not random
noise (which would destroy accuracy).

Usage:
    python -m ml.cli train export-vision --checkpoint runs/vision/best.pt
"""
from __future__ import annotations

import sys
from types import ModuleType


class MockLzmaModule(ModuleType):
    LZMAFile: object = object
    LZMAError: type[Exception] = Exception

    def open(self, *args, **kwargs):
        return None


if "_lzma" not in sys.modules:
    mock_lzma = MockLzmaModule("_lzma")
    sys.modules["_lzma"] = mock_lzma
    sys.modules["lzma"] = mock_lzma

import json
from pathlib import Path

import typer

app = typer.Typer(add_completion=False, help="Vision model export")

TARGET_SIZE_MB = 20


@app.command("run")
def run(
    checkpoint: Path = typer.Option(..., "--checkpoint", "-c"),
    calib_split: Path = typer.Option(
        Path("data/processed/splits/val.jsonl"),
        "--calib",
        help="JSONL to sample representative images from for INT8 calibration",
    ),
    calib_samples: int = typer.Option(200, "--samples"),
    out_dir: Path = typer.Option(Path("runs/vision/export"), "--out"),
) -> None:
    import numpy as np  # type: ignore
    import torch  # type: ignore

    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt = torch.load(checkpoint, map_location="cpu")
    if "class_to_idx" in ckpt:
        class_to_idx: dict[str, int] = ckpt["class_to_idx"]
        image_size: int = int(ckpt["image_size"])
        backbone: str = ckpt["backbone"]
        state_dict = ckpt["model"]
    else:
        class_to_idx = ckpt.get("label_map", {})
        image_size = 224
        backbone = "efficientnet_lite0"
        state_dict = ckpt.get("state_dict", {})

    from ml.train.vision_train import build_model

    num_classes = len(class_to_idx)
    for key in ["classifier.weight", "fc.weight", "head.fc.weight"]:
        if key in state_dict:
            num_classes = state_dict[key].shape[0]
            break

    model = build_model(num_classes, backbone)
    model.load_state_dict(state_dict)
    model.eval()

    # 1. PyTorch → ONNX
    onnx_path = out_dir / "model.onnx"
    dummy = torch.randn(1, 3, image_size, image_size)
    torch.onnx.export(
        model,
        (dummy,),
        onnx_path,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    typer.echo(f"ONNX export → {onnx_path}")

    # 2. ONNX → TF SavedModel (via onnx-tf)
    try:
        import onnx  # type: ignore
        from onnx_tf.backend import prepare  # type: ignore
    except ImportError as exc:
        raise typer.BadParameter(
            "onnx-tf is required for TFLite export. Install with "
            "`pip install onnx-tf tensorflow`. "
            f"Import error: {exc}"
        )

    onnx_model = onnx.load(str(onnx_path))
    tf_rep = prepare(onnx_model)
    saved_model_dir = out_dir / "saved_model"
    tf_rep.export_graph(str(saved_model_dir))
    typer.echo(f"TF SavedModel → {saved_model_dir}")

    # 3. TF SavedModel → TFLite INT8 with representative dataset
    import tensorflow as tf  # type: ignore

    def representative_dataset():
        rows = [json.loads(l) for l in calib_split.read_text().splitlines()][
            :calib_samples
        ]
        from PIL import Image  # type: ignore

        from ml.datasets.augment import eval_transform

        tfm = eval_transform(image_size)
        for r in rows:
            img = Image.open(r["path"]).convert("RGB")
            arr = np.array(img)
            tensor = tfm(image=arr)["image"]
            # Torch CHW → TF NHWC
            nhwc = tensor.permute(1, 2, 0).unsqueeze(0).numpy().astype(np.float32)
            yield [nhwc]

    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_model_dir))  # type: ignore
    converter.optimizations = [tf.lite.Optimize.DEFAULT]  # type: ignore
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]  # type: ignore
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8

    tflite_bytes = converter.convert()
    tflite_path = out_dir / "ishvenom_snakes_int8.tflite"
    tflite_path.write_bytes(tflite_bytes)

    size_mb = tflite_path.stat().st_size / (1024 * 1024)
    typer.echo(f"TFLite INT8 → {tflite_path} ({size_mb:.2f} MB)")

    # Sidecar label file
    labels_path = out_dir / "labels.json"
    labels_path.write_text(
        json.dumps(
            {
                "class_to_idx": class_to_idx,
                "image_size": image_size,
                "input_dtype": "int8",
                "backbone": backbone,
                "val_top3": ckpt.get("val_top3"),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    if size_mb > TARGET_SIZE_MB:
        typer.echo(
            f"WARNING: TFLite size {size_mb:.2f} MB exceeds target "
            f"{TARGET_SIZE_MB} MB. Consider a smaller backbone "
            "(efficientnet_lite0 → mobilenetv3_small_100) or pruning."
        )


if __name__ == "__main__":
    app()
