"""Actual signed sketch cuts, source dependencies and native cache recovery."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, panel as exact_panel, rows as exact_rows
from test_sketch import panel, inspect, select_sketch
from test_curves import open_curve


def model(document):
    assert document['schemaVersion'] == 9
    return document['sketchModel']


def profile(page, tmp_path, radius=2, x=0, z=4):
    previous = model(save_document(page, tmp_path, 'before-profile.json'))
    ids = {s['id'] for s in previous['sketches']}
    dialog = open_curve(page, radius=radius)
    dialog.get_by_label('Начало X', exact=True).fill(str(x))
    dialog.get_by_label('Начало Z', exact=True).fill(str(z))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    saved = save_document(page, tmp_path, 'after-profile.json')
    return next(s['id'] for s in model(saved)['sketches'] if s['id'] not in ids)


def base(page, tmp_path):
    create_box(page, size=(10, 10, 4), origin=(-5, -5, 0))
    saved = save_document(page, tmp_path, 'base.json')
    return saved['exactModel']['bodies'][0]['id']


def cut_dialog(page, target_id, depth=-1):
    panel(page).get_by_role('button', name='Вырезать по эскизу', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вырезание по эскизу', exact=True)
    dialog.get_by_label('Исходное тело', exact=True).select_option(target_id)
    dialog.get_by_label('Глубина вырезания', exact=True).fill(str(depth))
    return dialog


def cut(page, tmp_path, target_id, depth=-1):
    count = panel(page).locator('[data-cut-id]').count()
    dialog = cut_dialog(page, target_id, depth)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-cut-id]')).to_have_count(count + 1)
    return model(save_document(page, tmp_path, 'cut-created.json'))['cuts'][-1]


def upload(page, document, name):
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(document).encode(),
    })


@pytest.mark.parametrize('depth,volume', [(-1, 400 - 4 * math.pi), (-4, 400 - 16 * math.pi)])
def test_real_blind_and_through_cut_keep_hidden_original_without_cutter_body(page, tmp_path, depth, volume):
    prepare(page)
    target = base(page, tmp_path)
    sketch_id = profile(page, tmp_path)
    feature = cut(page, tmp_path, target, depth)
    assert feature['targetBodyId'] == target
    assert feature['sketchId'] == sketch_id
    assert feature['depth'] == depth
    assert feature['bodyId'] != target
    expect(exact_rows(page)).to_have_count(2)
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(volume, rel=1e-7)
    assert inspect(page, target)['volume'] == pytest.approx(400, rel=1e-9)
    saved = save_document(page, tmp_path)
    bodies = {b['id']: b for b in saved['exactModel']['bodies']}
    assert bodies[target]['visible'] is False
    assert bodies[feature['bodyId']]['visible'] is True


def test_cancel_and_zero_depth_leave_sources_visibility_and_native_brep_unchanged(page, tmp_path):
    prepare(page)
    target = base(page, tmp_path)
    profile(page, tmp_path)
    before = save_document(page, tmp_path, 'cut-cancel-before.json')
    dialog = cut_dialog(page, target)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'cut-cancel-after.json') == before
    dialog = cut_dialog(page, target, 0)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'cut-zero-after.json') == before


@pytest.mark.parametrize('radius,x', [(2, 20), (20, 0)], ids=['no-intersection', 'full-removal'])
def test_noop_or_complete_removal_rejects_without_document_commit(page, tmp_path, radius, x):
    prepare(page)
    target = base(page, tmp_path)
    profile(page, tmp_path, radius=radius, x=x)
    before = save_document(page, tmp_path, 'cut-rejected-before.json')
    dialog = cut_dialog(page, target, -4)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-cut-id]')).to_have_count(0)
    expect(exact_rows(page)).to_have_count(1)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'cut-rejected-after.json') == before


def test_profile_radius_rebuilds_cut_chain_same_ids_and_one_undo_restores_all(page, tmp_path):
    prepare(page)
    target = base(page, tmp_path)
    first_profile = profile(page, tmp_path)
    first = cut(page, tmp_path, target)
    profile(page, tmp_path, radius=.5, x=3)
    second = cut(page, tmp_path, first['bodyId'], -2)
    before = save_document(page, tmp_path, 'cut-chain-before.json')
    select_sketch(page, first_profile)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Радиус эскиза', exact=True).fill('1')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    after = save_document(page, tmp_path, 'cut-chain-after.json')
    assert model(after)['cuts'] == model(before)['cuts']
    assert inspect(page, first['bodyId'])['volume'] == pytest.approx(400 - math.pi, rel=1e-7)
    assert inspect(page, second['bodyId'])['volume'] == pytest.approx(400 - 1.5 * math.pi, rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'cut-chain-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


def test_reversed_native_cut_order_wrong_cache_rebuilds_topologically_and_recovers(page, tmp_path):
    prepare(page)
    target = base(page, tmp_path)
    profile(page, tmp_path)
    first = cut(page, tmp_path, target)
    profile(page, tmp_path, radius=.5, x=3)
    second = cut(page, tmp_path, first['bodyId'], -2)
    before = save_document(page, tmp_path, 'cut-native.json')
    changed = copy.deepcopy(before)
    model(changed)['cuts'].reverse()
    base_brep = next(b['brep'] for b in changed['exactModel']['bodies'] if b['id'] == target)
    for body in changed['exactModel']['bodies']:
        if body['id'] != target:
            body['brep'] = base_brep
    upload(page, changed, 'reversed-wrong-cache.json')
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    expected = 400 - 4.5 * math.pi
    assert inspect(page, second['bodyId'])['volume'] == pytest.approx(expected, rel=1e-7)
    rebuilt = save_document(page, tmp_path, 'cut-rebuilt.json')
    assert sorted(model(rebuilt)['cuts'], key=lambda c: c['id']) == sorted(model(before)['cuts'], key=lambda c: c['id'])
    assert model(rebuilt)['sketches'] == model(before)['sketches']
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, second['bodyId'])['volume'] == pytest.approx(expected, rel=1e-7)


@pytest.mark.parametrize('corruption', ['self-cycle', 'missing-target', 'zero-depth'])
def test_invalid_cut_native_import_is_atomic(page, tmp_path, corruption):
    prepare(page)
    target = base(page, tmp_path)
    profile(page, tmp_path)
    cut(page, tmp_path, target)
    before = save_document(page, tmp_path, 'cut-valid.json')
    invalid = copy.deepcopy(before)
    feature = model(invalid)['cuts'][0]
    if corruption == 'self-cycle':
        feature['targetBodyId'] = feature['bodyId']
    elif corruption == 'missing-target':
        feature['targetBodyId'] = 'missing-body'
    else:
        feature['depth'] = 0
    upload(page, invalid, 'invalid-cut.json')
    expect(page.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(1)
    assert save_document(page, tmp_path, 'cut-invalid-after.json') == before
