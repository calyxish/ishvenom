"""Convert an ONNX vision model to TFLite (optionally INT8).

This path avoids torch by starting from an existing ONNX export.
"""
from __future__ import annotations

import json
from pathlib import Path

import typer

app = typer.Typer(add_completion=False, help="ONNX -> TFLite export")


def _load_and_preprocess(path: str, image_size: int):
    from PIL import Image, ImageOps  # type: ignore
    import numpy as np  # type: ignore

    img = Image.open(path).convert("RGB")
    max_size = image_size + 32
    w, h = img.size
    scale = max_size / max(w, h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    img = img.resize((new_w, new_h), Image.BILINEAR)

    pad_w = max(0, max_size - new_w)
    pad_h = max(0, max_size - new_h)
    pad_left = pad_w // 2
    pad_top = pad_h // 2
    pad_right = pad_w - pad_left
    pad_bottom = pad_h - pad_top
    if pad_w or pad_h:
        img = ImageOps.expand(img, (pad_left, pad_top, pad_right, pad_bottom), fill=0)

    left = max(0, (img.width - image_size) // 2)
    top = max(0, (img.height - image_size) // 2)
    img = img.crop((left, top, left + image_size, top + image_size))

    arr = np.asarray(img).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    return arr


@app.command("run")
def run(
    onnx_path: Path = typer.Option(..., "--onnx", "-i"),
    calib_split: Path = typer.Option(
        Path("data/processed/splits/val.jsonl"),
        "--calib",
        help="JSONL to sample representative images from for INT8 calibration",
    ),
    calib_samples: int = typer.Option(200, "--samples"),
    image_size: int = typer.Option(224, "--image-size"),
    out_dir: Path = typer.Option(Path("runs/vision/export"), "--out"),
    quantize_int8: bool = typer.Option(True, "--int8/--float"),
) -> None:
    import numpy as np  # type: ignore
    import tensorflow as tf  # type: ignore

    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. ONNX -> TF SavedModel
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
    typer.echo(f"TF SavedModel -> {saved_model_dir}")

    # 2. TF SavedModel -> TFLite (INT8 or float)
    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_model_dir))  # type: ignore

    if quantize_int8:
        def representative_dataset():
            rows = [json.loads(l) for l in calib_split.read_text().splitlines()][
                :calib_samples
            ]
            for r in rows:
                out = _load_and_preprocess(r["path"], image_size)
                nhwc = np.expand_dims(out, axis=0)
                yield [nhwc]

        converter.optimizations = [tf.lite.Optimize.DEFAULT]  # type: ignore
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]  # type: ignore
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8
        tflite_name = "ishvenom_snakes_int8.tflite"
    else:
        tflite_name = "ishvenom_snakes_fp32.tflite"

    tflite_bytes = converter.convert()
    tflite_path = out_dir / tflite_name
    tflite_path.write_bytes(tflite_bytes)

    size_mb = tflite_path.stat().st_size / (1024 * 1024)
    typer.echo(f"TFLite -> {tflite_path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    app()
