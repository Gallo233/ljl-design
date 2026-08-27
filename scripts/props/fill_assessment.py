#!/usr/bin/env python3
"""Fill an img2threejs pre-spec assessment from an analysis file.

`new_pre_spec_assessment.py` writes a template whose object-class, complexity scores and
detail inventory are deliberately left `unassessed` — they are the agent's visual judgement,
not something a script can derive. This applies one prop's judgement to that template so the
values live in a reviewable file instead of only in a terminal session.

Usage: fill_assessment.py <assessment.json> <patch.json>
"""
import json
import sys
from pathlib import Path


def deep_update(target: dict, patch: dict) -> dict:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_update(target[key], value)
        else:
            target[key] = value
    return target


assessment_path, patch_path = Path(sys.argv[1]), Path(sys.argv[2])
assessment = json.loads(assessment_path.read_text())
deep_update(assessment, json.loads(patch_path.read_text()))
assessment_path.write_text(json.dumps(assessment, indent=2) + "\n")
print(f"patched {assessment_path}")
