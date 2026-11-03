"""Measured 2D dimensions retain source references, formats and atomic history."""
import json
import re
from pathlib import Path

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import workspace, sheet, entities, save_document
from test_drawing_review import import_drawing, line_drawing


def editor(page):
    page.locator('.drawing-toolbar').get_by_role('button', name='Размеры', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор размера', exact=True)
    expect(dialog).to_be_visible()
    return dialog


def source_345(page, tmp_path):
    drawing, source = line_drawing(page, tmp_path)
    source['geometry']['points'] = [[0, 0], [3, 4]]
    source.update(x=40, y=40, width=3, height=4)
    import_drawing(page, drawing)
    expect(sheet(page).locator(f'[data-drawing-id="{source["id"]}"]')).to_have_attribute('aria-pressed', 'false')
    return source['id']


def line_refs(dialog, source_id, kind):
    dialog.get_by_label('Тип размера', exact=True).select_option(kind)
    for label, anchor in [('A', 'start'), ('B', 'end')]:
        dialog.get_by_label(f'Способ опоры {label}', exact=True).select_option('entity')
        dialog.get_by_label(f'Источник {label}', exact=True).select_option(source_id)
        dialog.get_by_label(f'Якорь {label}', exact=True).select_option(anchor)


def measurement(dialog):
    text = dialog.locator('[data-dimension-measurement]').inner_text()
    value = re.search(r'-?\d+(?:[.,]\d+)?', text)
    assert value, f'Expected an actual measured value: {text}'
    return float(value.group().replace(',', '.'))


def graphic(page):
    return entities(page).last.locator('[data-dimension-kind]')


@pytest.mark.parametrize('kind,value', [('horizontal', 3), ('vertical', 4), ('aligned', 5)])
def test_real_345_source_yields_horizontal_vertical_and_aligned_dimensions(page, tmp_path, kind, value):
    workspace(page)
    source_id = source_345(page, tmp_path)
    dialog = editor(page)
    line_refs(dialog, source_id, kind)
    assert measurement(dialog) == value
    expect(entities(page)).to_have_count(1)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(entities(page)).to_have_count(2)
    expect(graphic(page)).to_have_attribute('data-dimension-kind', kind)
    expect(graphic(page)).to_have_attribute('data-dimension-value', str(value))
    assert graphic(page).locator('[data-dimension-primitive]').count() >= 3
    saved = save_document(page, tmp_path)
    dimension = saved['drawing']['sheets'][0]['entities'][-1]['dimension']
    assert dimension['kind'] == kind
    assert dimension['mode'] == 'driven'
    assert [ref['entityId'] for ref in dimension['refs']] == [source_id, source_id]


def test_source_change_recalculates_dimension_after_reopen_and_in_export(page, tmp_path):
    workspace(page)
    source_id = source_345(page, tmp_path)
    dialog = editor(page)
    line_refs(dialog, source_id, 'aligned')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(graphic(page)).to_have_attribute('data-dimension-value', '5')
    saved = save_document(page, tmp_path, 'before.json')
    drawing = saved['drawing']
    drawing['sheets'][0]['entities'][0]['geometry']['points'] = [[0, 0], [6, 8]]
    import_drawing(page, drawing)
    expect(graphic(page)).to_have_attribute('data-dimension-value', '10')
    page.reload(wait_until='domcontentloaded')
    workspace(page)
    expect(graphic(page)).to_have_attribute('data-dimension-value', '10')
    with page.expect_download() as download:
        page.get_by_role('button', name='Экспорт SVG', exact=True).click()
    target = tmp_path / 'dynamic-dimension.svg'
    download.value.save_as(target)
    import xml.etree.ElementTree as ET
    root = ET.fromstring(target.read_text())
    labels = [''.join(node.itertext()) for node in root.iter() if node.attrib.get('data-dimension-text') == 'true']
    assert labels and any(re.search(r'\b10(?:[.,]0+)?\b', text) for text in labels)
    after = save_document(page, tmp_path, 'after.json')
    assert after['drawing']['sheets'][0]['entities'][-1]['dimension']['refs'][0]['entityId'] == source_id


def test_typed_tolerance_precision_and_manual_label_preserve_measured_geometry(page, tmp_path):
    workspace(page)
    source_id = source_345(page, tmp_path)
    dialog = editor(page)
    line_refs(dialog, source_id, 'aligned')
    dialog.get_by_label('Точность', exact=True).fill('3')
    dialog.get_by_label('Режим допуска', exact=True).select_option('symmetric')
    dialog.get_by_label('Верхнее отклонение', exact=True).fill('0.2')
    assert measurement(dialog) == 5
    expect(dialog.locator('[data-dimension-label]')).to_contain_text('±')
    dialog.get_by_label('Переопределить текст', exact=True).check()
    dialog.get_by_label('Ручная подпись', exact=True).fill('Контрольный размер')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(graphic(page)).to_have_attribute('data-dimension-value', '5')
    expect(graphic(page).locator('[data-dimension-text]')).to_contain_text('Контрольный размер')
    saved = save_document(page, tmp_path)
    content = saved['drawing']['sheets'][0]['entities']
    definition = content[-1]['dimension']
    assert definition['format']['precision'] == 3
    assert definition['tolerance']['type'] == 'symmetric'
    assert definition['tolerance']['upper'] == 0.2
    assert definition['manualText'] == 'Контрольный размер'
    assert content[0]['geometry']['points'] == [[0, 0], [3, 4]]


def test_invalid_dimension_references_and_cancel_do_not_mutate_document(page, tmp_path):
    workspace(page)
    source_345(page, tmp_path)
    before = save_document(page, tmp_path, 'before-invalid.json')['drawing']
    dialog = editor(page)
    dialog.get_by_label('Тип размера', exact=True).select_option('aligned')
    for label in ['A', 'B']:
        dialog.get_by_label(f'Способ опоры {label}', exact=True).select_option('point')
        dialog.get_by_label(f'X опоры {label}', exact=True).fill('0')
        dialog.get_by_label(f'Y опоры {label}', exact=True).fill('0')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(dialog.get_by_role('alert')).to_be_visible()
    expect(entities(page)).to_have_count(1)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    after = save_document(page, tmp_path, 'after-invalid.json')['drawing']
    assert after == before


def test_dimension_palette_preserves_all_126_catalog_ids(page):
    workspace(page)
    panel = page.get_by_role('region', name='Инструменты размеров', exact=True)
    catalog = json.loads((Path(__file__).resolve().parents[1] / 'docs' / 'DRAWING_DIMENSION_TOOLKIT.json').read_text())
    expected = {feature['id'] for group in catalog['groups'] for feature in group['features']}
    actual = panel.locator('[data-dimension-command]').evaluate_all('(nodes) => nodes.map(n => n.dataset.dimensionCommand)')
    assert len(actual) == len(set(actual)) == 126
    assert set(actual) == expected


def test_unsupported_backends_have_disabled_commands_and_specific_reasons(page, tmp_path):
    workspace(page)
    before = save_document(page, tmp_path, 'before-unavailable.json')['drawing']
    for identifier, reason in [
        ('DIM-107', 'solver'),
        ('DIM-088', '3D'),
        ('DIM-074', 'норматив'),
        ('DIM-115', 'PMI'),
        ('DIM-123', 'DXF/DWG'),
    ]:
        button = page.locator(f'[data-dimension-command="{identifier}"]')
        expect(button).to_be_disabled()
        expect(button).to_have_attribute('title', re.compile(re.escape(reason), re.I))
    after = save_document(page, tmp_path, 'after-unavailable.json')['drawing']
    assert after == before
