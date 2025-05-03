#!/usr/bin/env python3
import json

jsonl_path = "/home/olier/Olierdev/merged_auromira.jsonl"

try:
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                # Skip empty lines
                continue
            try:
                json.loads(line)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON on line {i}: {line}")
                print(f"Error: {e}")
                exit(1)
    print("All lines are valid JSON.")
except FileNotFoundError:
    print(f"File not found: {jsonl_path}")
    exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    exit(1)
