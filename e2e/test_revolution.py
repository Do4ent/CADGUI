"""Signed local-axis revolutions measured from actual OCCT BREP bodies."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows, panel as exact_panel
from test_sketch import panel, create_sketch, inspect, select_sketch, edit_width
from test_curves import open_curve
from test_cuts import cut


def model(document):
    assert document['schemaVersion'] == 11
    return document['sketchModel']


def open_revolution(page, axis='v', offset=0, angle=360):
    panel(page).get_by_role('button', name='Вращать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вращение эскиза', exact=True)
    dialog.get_by_label('Ось вращения', exact=True).select_option(axis)
    dialog.get_by_label('Смещение оси', exact=True).fill(str(offset))
    dialog.get_by_label('Угол вращения', exact=True).fill(str(angle))
    return dialog


def revolve(page, tmp_path, **kwargs):
    count = panel(page).locator('[data-revolution-id]').count()
    dialog = open_revolution(page, **kwargs)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-revolution-id]')).to_have_count(count + 1)
    return model(save_document(page, tmp_path, 'revolution-created.json'))['revolutions'][-1]


@pytest.mark.parametrize('axis,angle,offset,volume,minimum,maximum', [
    ('v', 360, 0, 12 * math.pi, [-2, 0, -2], [2, 3, 2]),
    ('v', 90, 0, 3 * math.pi, [0, 0, -2], [2, 3, 0]),
    ('v', -90, 0, 3 * math.pi, [0, 0, 0], [2, 3, 2]),
    ('u', 360, 0, 18 * math.pi, [0, -3, -3], [2, 3, 3]),
    ('v', 360, -1, 24 * math.pi, [-4, 0, -3], [2, 3, 3]),
])
def test_actual_revolution_signed_angle_local_axis_and_annular_volume(page, tmp_path, axis, angle, offset, volume, minimum, maximum):
    prepare(page)
    sketch_id = create_sketch(page)
    feature = revolve(page, tmp_path, axis=axis, offset=offset, angle=angle)
    assert feature['sketchId'] == sketch_id
    expect(exact_rows(page)).to_have_count(1)
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(volume, rel=1e-7)
    assert result['bounds'][0] == pytest.approx(minimum, abs=1e-6)
    assert result['bounds'][1] == pytest.approx(maximum, abs=1e-6)


def test_circle_with_local_offset_produces_actual_torus(page, tmp_path):
    prepare(page)
    dialog = open_curve(page, radius=1)
    dialog.get_by_label('Начало X', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    # Offset is relative to the sketch origin: x=3 plus local -3 means world x=0.
    feature = revolve(page, tmp_path, offset=-3)
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(6 * math.pi ** 2, rel=1e-7)
    assert result['bounds'][0] == pytest.approx([-4, -1, -4], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([4, 1, 4], abs=1e-6)


def test_cancel_and_invalid_angle_preserve_native_sources_and_bodies(page, tmp_path):
    prepare(page)
    create_sketch(page)
    before = save_document(page, tmp_path, 'revolution-cancel-before.json')
    dialog = open_revolution(page)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'revolution-cancel-after.json') == before
    for angle in (0, 361, -361):
        dialog = open_revolution(page, angle=angle)
        expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
        dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'revolution-invalid-after.json') == before


def test_axis_through_profile_interior_rejects_without_commit(page, tmp_path):
    prepare(page)
    create_sketch(page)
    before = save_document(page, tmp_path, 'axis-crossing-before.json')
    dialog = open_revolution(page, offset=1)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(dialog.locator('[data-revolve-axis-error]')).to_contain_text('пересекает ось')
    expect(exact_rows(page)).to_have_count(0)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'axis-crossing-after.json') == before


def test_width_edit_rebuilds_same_revolution_body_and_one_undo_restores_native(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    feature = revolve(page, tmp_path)
    before = save_document(page, tmp_path, 'revolution-width-before.json')
    edit_width(page, sketch_id, 3)
    changed = save_document(page, tmp_path, 'revolution-width-after.json')
    assert model(changed)['revolutions'] == model(before)['revolutions']
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(27 * math.pi, rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'revolution-width-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


def test_schema10_wrong_cached_brep_rebuilds_revolution_and_recovers_source(page, tmp_path):
    prepare(page)
    create_sketch(page)
    feature = revolve(page, tmp_path)
    create_box(page, size=(1, 1, 1), origin=(20, 0, 0))
    before = save_document(page, tmp_path, 'revolution-native.json')
    other = next(b for b in before['exactModel']['bodies'] if b['id'] != feature['bodyId'])
    tampered = copy.deepcopy(before)
    next(b for b in tampered['exactModel']['bodies'] if b['id'] == feature['bodyId'])['brep'] = other['brep']
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'revolution-wrong-cache.json', 'mimeType': 'application/json', 'buffer': json.dumps(tampered).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(12 * math.pi, rel=1e-7)
    rebuilt = save_document(page, tmp_path, 'revolution-rebuilt.json')
    assert model(rebuilt) == model(before)
    assert next(b for b in rebuilt['exactModel']['bodies'] if b['id'] == other['id']) == other
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(12 * math.pi, rel=1e-7)
    assert model(save_document(page, tmp_path, 'revolution-recovered.json')) == model(before)


@pytest.mark.parametrize('plane,minimum,maximum', [
    ('XZ', [-2, -2, 0], [2, 2, 3]),
    ('YZ', [-2, -2, 0], [2, 2, 3]),
])
def test_non_xy_sketch_revolution_uses_world_frame(page, tmp_path, plane, minimum, maximum):
    prepare(page)
    create_sketch(page, plane=plane)
    feature = revolve(page, tmp_path)
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(12 * math.pi, rel=1e-7)
    assert result['bounds'][0] == pytest.approx(minimum, abs=1e-6)
    assert result['bounds'][1] == pytest.approx(maximum, abs=1e-6)


def test_source_revolution_cut_dependency_rebuild_and_feature_delete_cascade_undo(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    revolution = revolve(page, tmp_path)
    # XZ positive normal is -Y. A circle at y=3 cuts axially through the cylinder.
    dialog = open_curve(page, radius=.5, plane='XZ')
    dialog.get_by_label('Начало Y', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    downstream = cut(page, tmp_path, revolution['bodyId'], 3)
    before = save_document(page, tmp_path, 'revolve-cut-before.json')
    assert inspect(page, downstream['bodyId'])['volume'] == pytest.approx(11.25 * math.pi, rel=1e-7)
    edit_width(page, sketch_id, 3)
    changed = save_document(page, tmp_path, 'revolve-cut-after.json')
    assert model(changed)['revolutions'] == model(before)['revolutions']
    assert model(changed)['cuts'] == model(before)['cuts']
    assert inspect(page, downstream['bodyId'])['volume'] == pytest.approx(26.25 * math.pi, rel=1e-7)
    row = panel(page).locator(f'[data-revolution-id="{revolution["id"]}"]')
    row.get_by_role('button').first.click()
    panel(page).get_by_role('button', name='Удалить вращение и зависимые тела', exact=True).click()
    expect(exact_rows(page)).to_have_count(0, timeout=120000)
    expect(panel(page).locator('[data-cut-id]')).to_have_count(0)
    expect(panel(page).locator('[data-revolution-id]')).to_have_count(0)
    deleted = save_document(page, tmp_path, 'revolve-cut-deleted.json')
    assert model(deleted)['sketches'] == model(changed)['sketches']
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(exact_rows(page)).to_have_count(2, timeout=120000)
    restored = save_document(page, tmp_path, 'revolve-cut-restored.json')
    assert model(restored) == model(changed)
    assert restored['exactModel'] == changed['exactModel']


def test_global_revolution_ribbon_and_search_requests_are_acknowledged_once(page, tmp_path):
    prepare(page)
    ribbon_command = page.locator('.context-ribbon-strip').get_by_role('button', name='Вращение эскиза', exact=True)
    expect(ribbon_command).to_be_disabled()
    create_sketch(page)
    before = save_document(page, tmp_path, 'global-revolve-before.json')
    expect(ribbon_command).to_be_enabled()
    ribbon_command.click()
    dialog = page.get_by_role('dialog', name='Вращение эскиза', exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'global-revolve-ribbon-cancel.json') == before
    search = page.locator('.command-search input')
    search.fill('Вращение эскиза')
    search.press('Enter')
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'global-revolve-search-cancel.json') == before
    search.blur()
    page.keyboard.press('Alt+4')
    expect(page.locator('[data-drawing-sheet="true"]')).to_be_visible()
    page.keyboard.press('Alt+1')
    expect(panel(page)).to_be_visible()
    expect(dialog).not_to_be_visible()
    # Switching active documents remounts the panel; an acknowledged request must
    # not open a fresh dialog against either the empty document or the old source.
    page.get_by_title('Новый документ', exact=True).click()
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    expect(tabs).to_have_count(2)
    expect(dialog).not_to_be_visible()
    tabs.first.click()
    expect(panel(page)).to_be_visible()
    expect(dialog).not_to_be_visible()
    assert save_document(page, tmp_path, 'global-revolve-reactivated.json') == before
