"""Parametric fuse sources measured from real kernel bodies, including compounds."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, panel as exact_panel, rows as exact_rows
from test_sketch import panel, create_sketch, extrude, edit_width, inspect
from test_curves import open_curve


def state(page, tmp_path, name='fusion.json'):
    document = save_document(page, tmp_path, name)
    assert document['schemaVersion'] == 11
    return document


def box(page, tmp_path, origin=(0, 0, 0), size=(2, 3, 4)):
    ids = set(exact_rows(page).evaluate_all('(rows)=>rows.map(r=>r.dataset.exactBodyRow)'))
    create_box(page, size=size, origin=origin)
    return next(b['id'] for b in state(page, tmp_path)['exactModel']['bodies'] if b['id'] not in ids)


def open_fusion(page, a, b):
    panel(page).get_by_role('button', name='Объединить тела', exact=True).click()
    dialog = page.get_by_role('dialog', name='Объединение тел', exact=True)
    dialog.get_by_label('Тело A', exact=True).select_option(a)
    dialog.get_by_label('Тело B', exact=True).select_option(b)
    return dialog


def fuse(page, tmp_path, a, b):
    count = panel(page).locator('[data-fusion-id]').count()
    dialog = open_fusion(page, a, b)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-fusion-id]')).to_have_count(count + 1)
    return state(page, tmp_path)['sketchModel']['fusions'][-1]


def circle_cut(page, tmp_path, target, x=1):
    dialog = open_curve(page, radius=.25)
    for label, value in [('Начало X', x), ('Начало Y', 1.5), ('Начало Z', 4)]:
        dialog.get_by_label(label, exact=True).fill(str(value))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    panel(page).get_by_role('button', name='Вырезать по эскизу', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вырезание по эскизу', exact=True)
    dialog.get_by_label('Исходное тело', exact=True).select_option(target)
    dialog.get_by_label('Глубина вырезания', exact=True).fill('-4')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    return state(page, tmp_path)['sketchModel']['cuts'][-1]


@pytest.mark.parametrize('origin,volume,solids', [((1, 0, 0), 36, 1), ((4, 0, 0), 48, 2)])
def test_actual_overlap_union_and_disjoint_compound_keep_operand_sources(page, tmp_path, origin, volume, solids):
    prepare(page)
    a = box(page, tmp_path)
    b = box(page, tmp_path, origin=origin)
    feature = fuse(page, tmp_path, a, b)
    expect(exact_rows(page)).to_have_count(3)
    assert feature['bodyId'] not in (a, b)
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(volume, rel=1e-7)
    expect(exact_panel(page).locator('[data-exact-solids]')).to_have_attribute('data-exact-solids', str(solids))
    assert result['bounds'][0] == pytest.approx([0, 0, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([origin[0] + 2, 3, 4], abs=1e-6)
    document = state(page, tmp_path)
    bodies = {body['id']: body for body in document['exactModel']['bodies']}
    assert bodies[a]['visible'] is False and bodies[b]['visible'] is False
    assert bodies[feature['bodyId']]['visible'] is True
    assert inspect(page, a)['volume'] == pytest.approx(24, rel=1e-7)
    assert inspect(page, b)['volume'] == pytest.approx(24, rel=1e-7)


def test_cancel_and_identical_operands_do_not_mutate_native_document(page, tmp_path):
    prepare(page)
    a = box(page, tmp_path)
    b = box(page, tmp_path, origin=(1, 0, 0))
    before = state(page, tmp_path, 'fusion-before-cancel.json')
    dialog = open_fusion(page, a, b)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert state(page, tmp_path, 'fusion-cancel.json') == before
    dialog = open_fusion(page, a, a)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert state(page, tmp_path, 'fusion-invalid.json') == before


def test_extrusion_cut_fusion_cut_graph_rebuilds_then_atomic_undo(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    extrude(page, 4)
    base = state(page, tmp_path)['sketchModel']['extrusions'][0]['bodyId']
    first_cut = circle_cut(page, tmp_path, base)
    addition = box(page, tmp_path, origin=(2, 0, 0))
    fusion = fuse(page, tmp_path, first_cut['bodyId'], addition)
    last_cut = circle_cut(page, tmp_path, fusion['bodyId'], x=3)
    before = state(page, tmp_path, 'fusion-graph-before.json')
    assert inspect(page, last_cut['bodyId'])['volume'] == pytest.approx(48 - .5 * math.pi, rel=1e-7)
    edit_width(page, sketch_id, 5)
    after = state(page, tmp_path, 'fusion-graph-after.json')
    for key in ('extrusions', 'cuts', 'fusions'):
        assert after['sketchModel'][key] == before['sketchModel'][key]
    assert inspect(page, last_cut['bodyId'])['volume'] == pytest.approx(60 - .5 * math.pi, rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = state(page, tmp_path, 'fusion-graph-undone.json')
    assert undone['sketchModel'] == before['sketchModel']
    assert undone['exactModel'] == before['exactModel']


@pytest.mark.parametrize('invalid_kind', ['missing', 'self-cycle'])
def test_invalid_fusion_import_rolls_back_whole_document(page, tmp_path, invalid_kind):
    prepare(page)
    a = box(page, tmp_path)
    b = box(page, tmp_path, origin=(1, 0, 0))
    fuse(page, tmp_path, a, b)
    before = state(page, tmp_path, 'fusion-valid.json')
    invalid = copy.deepcopy(before)
    feature = invalid['sketchModel']['fusions'][0]
    feature['a'] = 'missing-body' if invalid_kind == 'missing' else feature['bodyId']
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'fusion-invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode(),
    })
    expect(page.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(1)
    assert state(page, tmp_path, 'fusion-import-rollback.json') == before
