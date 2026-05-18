from __future__ import annotations

import sys
import torch
from types import ModuleType

# Mock _lzma to prevent torchvision import errors
class MockLzmaModule(ModuleType):
    LZMAFile: object = object
    LZMAError: type[Exception] = Exception
    def open(self, *args, **kwargs): return None

if "_lzma" not in sys.modules:
    mock_lzma = MockLzmaModule("_lzma")
    sys.modules["_lzma"] = mock_lzma
    sys.modules["lzma"] = mock_lzma

from ml.train.vision_train import build_model

def main():
    ckpt_path = "ml/runs/vision/best_vision.pt"
    print(f"Loading checkpoint from: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location="cpu")
    
    label_map = ckpt.get("label_map", {})
    num_classes = len(label_map)
    print(f"Detected {num_classes} output classes in label_map.")
    
    state_dict = ckpt.get("state_dict", ckpt)
    
    print("Building model backbone...")
    model = build_model(num_classes=num_classes, backbone="efficientnet_lite0")
    model.load_state_dict(state_dict)
    model.eval()
    
    print("Running forward pass with test tensor...")
    with torch.no_grad():
        dummy_input = torch.randn(1, 3, 224, 224)
        logits = model(dummy_input)
        
    print(f"Success! Output logits shape: {logits.shape}")
    print("Model verification complete. Ready for mobile app integration.")

if __name__ == "__main__":
    main()
