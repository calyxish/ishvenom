"""IshVenom Phase 3: training, quantization, evaluation.

Every trainer in this package enforces the Phase 2 safety gate before it
touches any model weights. See `ml.train.safety.assert_training_safe`.
"""
