"""Source-owned inner wires, exact ring solids and transactional hole rebuilds."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows, panel as exact_panel
from test_sketch import panel, sketch_rows, extrude, inspect, select_sketch
from test_curves import open_curve


def model(document):
    assert document['schemaVersion'] == 8
    return document['sketchModel']


def open_ring(page):
    panel(page).get_by_role('button', name='Создать кольцевой профиль', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Радиус эскиза', exact=True).fill('5')
    dialog.get_by_label('Радиус отверстия', exact=True).fill('2')
    return dialog


def create_ring(page, plane='XY'):
    dialog = open_ring(page)
    dialog.get_by_label('Плоскость', exact=True).select_option(plane)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(sketch_rows(page)).to_have_count(2)


def ring_sources(document):
    state = model(document)
    outer = next(sketch for sketch in state['sketches'] if sketch.get('holes'))
    inner = next(sketch for sketch in state['sketches'] if sketch['id'] == outer['holes'][0])
    return outer, inner


def test_cancel_ring_preset_creates_neither_outer_nor_inner_source(page, tmp_path):
    prepare(page)
    before = save_document(page, tmp_path, 'ring-cancel-before.json')
    dialog = open_ring(page)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(sketch_rows(page)).to_have_count(0)
    expect(exact_rows(page)).to_have_count(0)
    assert save_document(page, tmp_path, 'ring-cancel-after.json') == before


def test_ring_extrudes_one_real_solid_with_inner_wall_and_exact_area(page, tmp_path):
    prepare(page)
    create_ring(page)
    extrude(page, 3)
    saved = save_document(page, tmp_path)
    outer, inner = ring_sources(saved)
    assert outer['geometry']['kind'] == inner['geometry']['kind'] == 'circle'
    assert len(model(saved)['extrusions']) == 1
    feature = model(saved)['extrusions'][0]
    assert feature['sketchId'] == outer['id']
    assert all(e['sketchId'] != inner['id'] for e in model(saved)['extrusions'])
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(63 * math.pi, rel=1e-7)
    area = exact_panel(page).locator('[data-exact-area]')
    expect(area).to_be_visible()
    assert float(area.get_attribute('data-exact-area')) == pytest.approx(84 * math.pi, rel=1e-7)
    assert result['bounds'][0] == pytest.approx([-5, -5, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([5, 5, 3], abs=1e-6)


def test_inner_radius_edit_rebuilds_every_owner_body_and_undo_restores_both(page, tmp_path):
    prepare(page)
    create_ring(page)
    baseline = save_document(page, tmp_path, 'ring-sources.json')
    outer, inner = ring_sources(baseline)
    select_sketch(page, outer['id'])
    extrude(page, 3)
    select_sketch(page, outer['id'])
    extrude(page, 2)
    before = save_document(page, tmp_path, 'ring-two-depths.json')
    select_sketch(page, inner['id'])
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Радиус эскиза', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    after = save_document(page, tmp_path, 'ring-radius3.json')
    assert model(after)['extrusions'] == model(before)['extrusions']
    for feature in model(after)['extrusions']:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(16 * math.pi * feature['depth'], rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'ring-radius-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


def test_delete_inner_source_fills_outer_preserves_unrelated_body_and_undo(page, tmp_path):
    prepare(page)
    create_ring(page)
    extrude(page, 3)
    create_box(page, size=(1, 1, 1), origin=(20, 0, 0))
    before = save_document(page, tmp_path, 'ring-delete-before.json')
    outer, inner = ring_sources(before)
    body_id = model(before)['extrusions'][0]['bodyId']
    other = next(body for body in before['exactModel']['bodies'] if body['id'] != body_id)
    select_sketch(page, inner['id'])
    panel(page).get_by_role('button', name='Удалить эскиз и тела', exact=True).click()
    deletion = page.get_by_role('dialog', name='Удаление эскиза', exact=True)
    deletion.get_by_role('button', name='ОК', exact=True).click()
    expect(deletion).not_to_be_visible(timeout=120000)
    expect(sketch_rows(page)).to_have_count(1)
    assert inspect(page, body_id)['volume'] == pytest.approx(75 * math.pi, rel=1e-7)
    after = save_document(page, tmp_path, 'ring-filled.json')
    assert not model(after)['sketches'][0].get('holes')
    assert next(body for body in after['exactModel']['bodies'] if body['id'] == other['id']) == other
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'ring-delete-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


@pytest.mark.parametrize('plane,depth,extents', [('XY', -3, [10, 10, 3]), ('XZ', 3, [10, 3, 10]), ('YZ', -3, [3, 10, 10])])
def test_ring_signed_extrusion_uses_coplanar_inner_wire(page, tmp_path, plane, depth, extents):
    prepare(page)
    create_ring(page, plane)
    extrude(page, depth)
    saved = save_document(page, tmp_path)
    outer, inner = ring_sources(saved)
    assert outer['plane'] == inner['plane'] == plane
    feature = model(saved)['extrusions'][0]
    assert feature['depth'] == depth
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(63 * math.pi, rel=1e-7)
    assert [hi - lo for lo, hi in zip(*result['bounds'])] == pytest.approx(extents, abs=1e-6)


@pytest.mark.parametrize('corruption', ['missing', 'duplicate', 'self', 'outside', 'nested'])
def test_invalid_hole_sources_import_atomically_without_replacing_native(page, tmp_path, corruption):
    prepare(page)
    create_ring(page)
    extrude(page, 3)
    before = save_document(page, tmp_path, 'ring-valid.json')
    malformed = copy.deepcopy(before)
    outer, inner = ring_sources(malformed)
    if corruption == 'missing':
        outer['holes'] = ['missing-profile']
    elif corruption == 'duplicate':
        outer['holes'] *= 2
    elif corruption == 'self':
        outer['holes'] = [outer['id']]
    elif corruption == 'outside':
        inner['origin'][0] += 20
    else:
        inner['holes'] = [outer['id']]
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'invalid-holes.json', 'mimeType': 'application/json', 'buffer': json.dumps(malformed).encode(),
    })
    expect(page.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(1)
    assert save_document(page, tmp_path, 'ring-invalid-after.json') == before


def test_schema8_native_holes_rebuild_owned_wrong_cache_and_recover(page, tmp_path):
    prepare(page)
    create_ring(page)
    extrude(page, 3)
    create_box(page, size=(1, 1, 1), origin=(20, 0, 0))
    before = save_document(page, tmp_path, 'ring-native.json')
    body_id = model(before)['extrusions'][0]['bodyId']
    other = next(body for body in before['exactModel']['bodies'] if body['id'] != body_id)
    tampered = copy.deepcopy(before)
    next(body for body in tampered['exactModel']['bodies'] if body['id'] == body_id)['brep'] = other['brep']
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'ring-wrong-cache.json', 'mimeType': 'application/json', 'buffer': json.dumps(tampered).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(63 * math.pi, rel=1e-7)
    rebuilt = save_document(page, tmp_path, 'ring-rebuilt.json')
    assert model(rebuilt) == model(before)
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] == other['id']) == other
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] == body_id)['brep'] != other['brep']
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, body_id)['volume'] == pytest.approx(63 * math.pi, rel=1e-7)
    assert model(save_document(page, tmp_path, 'ring-recovered.json')) == model(before)


def test_accepted_hole_preview_evenodd_assignment_cancel_and_second_offset_hole(page, tmp_path):
    prepare(page)
    create_ring(page)
    before = save_document(page, tmp_path, 'ring-assignment-before.json')
    outer, inner = ring_sources(before)
    select_sketch(page, outer['id'])
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    preview = dialog.get_by_role('img', name='Область с отверстиями', exact=True)
    path = preview.locator('[data-sketch-region-path]')
    expect(path).to_have_attribute('fill-rule', 'evenodd')
    expect(path).to_have_attribute('data-sketch-region-holes', '1')
    assert path.get_attribute('d').count('A') == 4
    checkbox = dialog.locator(f'input[data-hole-source-id="{inner["id"]}"]')
    expect(checkbox).to_be_checked()
    checkbox.uncheck()
    expect(path).to_have_attribute('data-sketch-region-holes', '0')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'ring-assignment-cancelled.json') == before
    # An in-plane origin translation places a separate small circle inside the outer,
    # disjoint from the existing central hole.
    dialog = open_curve(page, radius=.5)
    dialog.get_by_label('Начало X', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    added = save_document(page, tmp_path, 'ring-second-circle.json')
    second = next(s for s in model(added)['sketches'] if s['id'] not in (outer['id'], inner['id']))
    select_sketch(page, outer['id'])
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.locator(f'input[data-hole-source-id="{second["id"]}"]').check()
    expect(dialog.locator('[data-sketch-region-path]')).to_have_attribute('data-sketch-region-holes', '2')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    extrude(page, 3)
    saved = save_document(page, tmp_path, 'ring-two-holes.json')
    owner = next(s for s in model(saved)['sketches'] if s['id'] == outer['id'])
    assert set(owner['holes']) == {inner['id'], second['id']}
    assert inspect(page, model(saved)['extrusions'][0]['bodyId'])['volume'] == pytest.approx(62.25 * math.pi, rel=1e-7)
