"""Albumentations augmentation pipeline for the snake vision dataset.

Heavy augmentation is necessary because real-world snake photos taken by a
panicked bystander are very different from clean iNaturalist research photos.
We simulate low light, partial occlusion, motion blur, and perspective.

Usage as a library:
    from ml.datasets.augment import build_training_transform
    tfm = build_training_transform(image_size=224)
    augmented = tfm(image=np_image)["image"]
"""
from __future__ import annotations


def build_training_transform(image_size: int = 224):
    """Heavy augmentation for training. Requires `albumentations` installed."""
    try:
        import albumentations as A
        from albumentations.pytorch import ToTensorV2
    except ImportError as e:
        raise RuntimeError(
            "Install training extras: pip install -e .[training]"
        ) from e

    return A.Compose(
        [
            A.LongestMaxSize(max_size=image_size + 32),
            A.PadIfNeeded(
                min_height=image_size + 32,
                min_width=image_size + 32,
                border_mode=0,
            ),
            A.RandomCrop(height=image_size, width=image_size),
            A.HorizontalFlip(p=0.5),
            A.Rotate(limit=30, p=0.7),
            A.RandomBrightnessContrast(brightness_limit=0.4, contrast_limit=0.3, p=0.8),
            A.MotionBlur(blur_limit=(3, 9), p=0.3),
            A.GaussNoise(var_limit=(10.0, 40.0), p=0.3),
            A.CoarseDropout(
                max_holes=8,
                max_height=int(image_size * 0.2),
                max_width=int(image_size * 0.2),
                p=0.4,
            ),
            A.RandomShadow(p=0.3),
            A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=10, p=0.5),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )


def build_eval_transform(image_size: int = 224):
    """Minimal deterministic transform for val/test."""
    try:
        import albumentations as A
        from albumentations.pytorch import ToTensorV2
    except ImportError as e:
        raise RuntimeError("Install training extras") from e

    return A.Compose(
        [
            A.LongestMaxSize(max_size=image_size + 32),
            A.PadIfNeeded(
                min_height=image_size + 32,
                min_width=image_size + 32,
                border_mode=0,
            ),
            A.CenterCrop(height=image_size, width=image_size),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )
