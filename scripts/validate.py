#!/usr/bin/env python3
"""Validate catalog, lessons, references, and answer data using Python's standard library."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def require(condition, message):
    if not condition:
        raise ValueError(message)

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def validate_lesson(data):
    require(data['schemaVersion'] == 1, 'Unsupported schemaVersion')
    require(data['id'] and data['title'] and data['subtitle'], 'Lesson metadata missing')
    require(isinstance(data['number'], int) and data['number'] > 0, 'Invalid lesson number')
    require(isinstance(data['contentVersion'], int) and data['contentVersion'] > 0, 'Invalid contentVersion')
    require(bool(data['source']['answerKey']), 'Document where answers come from')
    expressions = data['expressions']
    ids = [e['id'] for e in expressions]
    require(ids and len(ids) == len(set(ids)), 'Expression IDs must be unique')
    for e in expressions:
        require(e['phrase'] and e['meaning'] and e['examples'] and e['dialogue'], 'Expression content missing')
        require(all(isinstance(s, str) and s for s in e['examples'] + e['dialogue']), 'Invalid example text')
    questions = data['practice']['questions']
    require(questions, 'Include practice questions')
    require(len({q['id'] for q in questions}) == len(questions), 'Question IDs must be unique')
    for q in questions:
        require(q['prompt'].count('____') == 1, f"{q['id']}: use exactly one ____ blank")
        require(len(q['options']) >= 2 and len(set(q['options'])) == len(q['options']), 'Invalid options')
        require(q['answer'] in q['options'], f"{q['id']}: answer must match an option exactly")
        require(q['expressionId'] in ids and q['explanation'], 'Missing answer reference or explanation')
    dialogue = data['dialogue']
    lines = dialogue['lines']
    require(len({l['id'] for l in lines}) == len(lines), 'Dialogue IDs must be unique')
    blanks = [l for l in lines if 'answer' in l]
    require(blanks and len(blanks) == len(dialogue['wordBank']), 'Word bank must cover all dialogue blanks')
    require(sorted(l['answer'] for l in blanks) == sorted(dialogue['wordBank']), 'Use each word-bank expression once')
    for line in lines:
        require(line['speaker'] and line['text'], 'Empty dialogue line')
        require(line['text'].count('____') == (1 if 'answer' in line else 0), 'Invalid dialogue blank')
        if 'answer' in line:
            require(line['expressionId'] in ids and line['explanation'], 'Missing dialogue answer details')
    story = data['story']
    require(story['paragraphs'] and all(isinstance(p, str) and p for p in story['paragraphs']), 'Story is empty')
    for h in story['highlights']:
        require(h['expressionId'] in ids, 'Invalid story expression reference')
        require(any(h['text'] in p for p in story['paragraphs']), f"Story highlight not found: {h['text']}")
    return len(expressions), len(questions), len(blanks)

def validate():
    catalog = read(ROOT / 'data/lessons.json')
    require(catalog['schemaVersion'] == 1 and catalog['lessons'], 'Catalog is empty or unsupported')
    require(len({l['id'] for l in catalog['lessons']}) == len(catalog['lessons']), 'Duplicate catalog lesson ID')
    for entry in catalog['lessons']:
        path = (ROOT / entry['file']).resolve()
        require(path.is_relative_to(ROOT), 'Lesson files must stay within the app folder')
        lesson = read(path)
        require(lesson['id'] == entry['id'], 'Catalog and lesson IDs differ')
        require(lesson['number'] == entry['number'] and lesson['title'] == entry['title'], 'Catalog metadata differs')
        counts = validate_lesson(lesson)
        print(f"PASS {entry['id']}: {counts[0]} expressions, {counts[1]} questions, {counts[2]} dialogue blanks")
    validate_lesson(read(ROOT / 'data/lesson-template.json'))
    for file in ['index.html', 'styles.css', 'app.js', 'assets/favicon.svg', '.nojekyll']:
        require((ROOT / file).is_file(), f'Missing app file: {file}')
    print('PASS template, story highlights, answer references, and app files')
    return catalog

if __name__ == '__main__':
    validate()
