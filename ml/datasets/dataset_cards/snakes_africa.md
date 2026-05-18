---
license: apache-2.0
task_categories:
  - image-classification
tags:
  - biology
  - snakes
  - africa
  - medical
  - public-health
  - neglected-tropical-disease
pretty_name: IshVenom Snakes of Africa
size_categories:
  - 1K<n<10K
---

# IshVenom Snakes of Africa

Research-grade photographs of 20 medically significant African snake species,
curated for training the IshVenom on-device snakebite triage classifier.

## Motivation

Snakebite envenoming kills roughly 30,000 people a year in sub-Saharan Africa
and causes ~8,000 amputations. The WHO classified it as a Neglected Tropical
Disease in 2017 specifically because surveillance data is so poor. A key
precondition for building better tools is a clean, permissively-licensed
training dataset. At the time of this dataset's creation, no single public
dataset existed that covered the 20 highest-priority African species with
consistent license metadata.

## Composition

- **20 species** — see `ml/datasets/species/priority_species.json`
- **Sources:** iNaturalist (research-grade) + GBIF (museum/occurrence)
- **Licenses included:** CC0, CC-BY, CC-BY-SA, Public Domain — no restrictive
  licenses
- **Splits:** 70 / 15 / 15 stratified per species
- **Quality gate:** minimum 224×224 resolution, pHash dedup, Laplacian-variance
  blur threshold of 100
- **Target scale:** ~200 images/species = ~4,000 total raw

## Species list

See `ml/datasets/species/priority_species.json` for scientific names,
venom types, range countries, and antivenom information.

## Intended use

- Training and evaluating snake species classifiers for medical triage
- Benchmarking CPU-native mobile inference on entry-level Android devices
- Public health research on African snake distribution

## Not intended for

- Automated species identification without human/clinical oversight
- Use in clinical decision-making without validation on a local test set
- Commercial use of images whose underlying license requires attribution
  without providing that attribution

## Ethics and attribution

Every image in this dataset carries its original iNaturalist or GBIF license
code in the metadata. Downstream users MUST honour the attribution
requirements of CC-BY and CC-BY-SA licenses.

## Citation

```
@dataset{ishvenom_snakes_africa_2026,
  author = {Kwakye Ishmael Affum},
  title  = {IshVenom Snakes of Africa},
  year   = {2026},
  url    = {https://huggingface.co/datasets/calyxish/ishvenom-snakes-africa}
}
```
