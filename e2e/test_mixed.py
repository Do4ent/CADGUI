"""Ordered line/arc sources and exact OCCT extrusion of a capsule."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows
from test_sketch import panel, sketch_rows, extrude, inspect, select_sketch


def open_mixed(page, length=6, radius=2, plane='XY'):
    panel(page).get_by_role('button', name='Создать смешанный контур', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Длина прямой части', exact=True).fill(str(length))
    dialog.get_by_label('Радиус эскиза', exact=True).fill(str(radius))
    dialog.get_by_label('Плоскость', exact=True).select_option(plane)
    return dialog


def create_mixed(page, **kwargs):
    dialog = open_mixed(page, **kwargs)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    return sketch_rows(page).first.get_attribute('data-sketch-id')


def model(document):
    assert document['schemaVersion'] == 7
    return document['sketchModel']


def upload(page, document, name):
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(document).encode(),
    })


def test_actual_mixed_svg_and_exact_capsule_volume_bounds(page, tmp_path):
    prepare(page)
    dialog = open_mixed(page)
    expect(dialog.locator('[data-sketch-segment-kind="line"]')).to_have_count(2)
    arcs = dialog.locator('[data-sketch-segment-kind="arc"]')
    expect(arcs).to_have_count(2)
    for arc in arcs.all():
        assert 'A' in arc.get_attribute('d')
        assert float(arc.get_attribute('data-sketch-arc-sweep')) == pytest.approx(math.pi)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    extrude(page, 3)
    state = model(save_document(page, tmp_path))
    segments = state['sketches'][0]['geometry']['segments']
    assert [segment['kind'] for segment in segments] == ['line', 'arc', 'line', 'arc']
    assert all(segment['end'] == segments[(i + 1) % 4]['start'] for i, segment in enumerate(segments))
    result = inspect(page, state['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert result['bounds'][0] == pytest.approx([-2, -2, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([8, 2, 3], abs=1e-6)


def test_length_radius_edit_rebuilds_both_owned_bodies_and_undo_is_atomic(page, tmp_path):
    prepare(page)
    sketch_id = create_mixed(page)
    extrude(page, 3)
    select_sketch(page, sketch_id)
    extrude(page, 2)
    before = save_document(page, tmp_path, 'mixed-before.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Длина прямой части', exact=True).fill('8')
    dialog.get_by_label('Радиус эскиза', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    after = save_document(page, tmp_path, 'mixed-after.json')
    assert model(after)['extrusions'] == model(before)['extrusions']
    for feature in model(after)['extrusions']:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx((48 + 9 * math.pi) * feature['depth'], rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'mixed-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


@pytest.mark.parametrize('plane,depth,extents', [
    ('XY', -3, [10, 4, 3]), ('XZ', 3, [10, 3, 4]), ('YZ', -3, [3, 10, 4]),
])
def test_mixed_signed_extrusion_uses_actual_plane_bounds(page, tmp_path, plane, depth, extents):
    prepare(page)
    create_mixed(page, plane=plane)
    extrude(page, depth)
    state = model(save_document(page, tmp_path))
    assert state['sketches'][0]['plane'] == plane
    assert state['extrusions'][0]['depth'] == depth
    result = inspect(page, state['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert [hi - lo for lo, hi in zip(*result['bounds'])] == pytest.approx(extents, abs=1e-6)


def test_schema7_native_source_rebuilds_wrong_cache_and_survives_recovery(page, tmp_path):
    prepare(page)
    create_mixed(page)
    extrude(page, 3)
    create_box(page, size=(1, 1, 1), origin=(20, 0, 0))
    before = save_document(page, tmp_path, 'mixed-native.json')
    body_id = model(before)['extrusions'][0]['bodyId']
    unrelated = next(body for body in before['exactModel']['bodies'] if body['id'] != body_id)
    tampered = copy.deepcopy(before)
    next(body for body in tampered['exactModel']['bodies'] if body['id'] == body_id)['brep'] = unrelated['brep']
    upload(page, tampered, 'mixed-wrong-cache.json')
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    rebuilt = save_document(page, tmp_path, 'mixed-rebuilt.json')
    assert model(rebuilt) == model(before)
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] != body_id) == unrelated
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] == body_id)['brep'] != unrelated['brep']
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, body_id)['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert model(save_document(page, tmp_path, 'mixed-recovered.json')) == model(before)


@pytest.mark.parametrize('corruption', ['missing-point', 'broken-order'])
def test_malformed_mixed_import_preserves_document_atomically(page, tmp_path, corruption):
    prepare(page)
    create_mixed(page)
    extrude(page, 3)
    before = save_document(page, tmp_path, 'mixed-valid.json')
    malformed = copy.deepcopy(before)
    segments = model(malformed)['sketches'][0]['geometry']['segments']
    if corruption == 'missing-point':
        segments[1]['center'] = 'not-present'
    else:
        segments[0], segments[1] = segments[1], segments[0]
    upload(page, malformed, 'malformed-mixed.json')
    expect(page.get_by_role('alert').filter(has_text='Смешанный')).to_be_visible(timeout=120000)
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(1)
    assert save_document(page, tmp_path, 'mixed-after-invalid.json') == before


def test_open_mixed_source_cannot_extrude_and_cancel_preserves_document(page, tmp_path):
    prepare(page)
    dialog = open_mixed(page)
    dialog.get_by_label('Замкнутый профиль', exact=True).uncheck()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    before = save_document(page, tmp_path, 'mixed-open.json')
    assert model(before)['sketches'][0]['closed'] is False
    panel(page).get_by_role('button', name='Выдавить эскиз', exact=True).click()
    extrusion = page.get_by_role('dialog', name='Выдавливание эскиза', exact=True)
    extrusion.get_by_label('Глубина выдавливания', exact=True).fill('3')
    extrusion.get_by_role('button', name='ОК', exact=True).click()
    expect(extrusion.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(exact_rows(page)).to_have_count(0)
    extrusion.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'mixed-open-after.json') == before
