"""Leaf suppression retains parametric definitions and rebuilds exact bodies."""

import pytest
from playwright.sync_api import expect

from test_drawing import save_document
from test_fusion import box, fuse
from test_kernel import panel as exact_panel, prepare
from test_regression import browser, page
from test_sketch import create_sketch, extrude, inspect


def history_feature(page, kind, feature_id):
    tree = page.get_by_role('tree', name='Объекты истории построения', exact=True)
    return tree.get_by_role('treeitem').and_(tree.locator(f'[data-history-id="{kind}:{feature_id}"]'))


def body_row(page, body_id):
    return exact_panel(page).locator(f'[data-exact-body-row="{body_id}"]')


def confirm_action(page, action, dialog_name, confirmation):
    controls = page.get_by_role('region', name='Подавление операции', exact=True)
    controls.get_by_role('button', name=action, exact=True).click()
    dialog = page.get_by_role('dialog', name=dialog_name, exact=True)
    dialog.get_by_role('button', name=confirmation, exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)


def test_leaf_extrusion_suppression_undo_native_reopen_and_resume(page, tmp_path):
    prepare(page)
    create_sketch(page, width=2, height=3)
    extrude(page, depth=4)
    source = save_document(page, tmp_path, 'active-extrusion.json')
    feature = source['sketchModel']['extrusions'][0]
    body_id = feature['bodyId']
    original = next(body for body in source['exactModel']['bodies'] if body['id'] == body_id)
    row = history_feature(page, 'extrusion', feature['id'])
    row.click()
    confirm_action(page, 'Подавить операцию', 'Подавление операции', 'Подавить')
    expect(body_row(page, body_id)).to_have_count(0, timeout=120000)
    expect(row).to_contain_text('Подавлено')
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(body_row(page, body_id)).to_have_count(1)
    undone = save_document(page, tmp_path, 'undo-suppression.json')
    assert undone['sketchModel'] == source['sketchModel']
    assert undone['exactModel'] == source['exactModel']

    row.click()
    confirm_action(page, 'Подавить операцию', 'Подавление операции', 'Подавить')
    expect(body_row(page, body_id)).to_have_count(0, timeout=120000)
    suppressed = save_document(page, tmp_path, 'suppressed-extrusion.json')
    assert suppressed['schemaVersion'] == 22
    assert suppressed['sketchModel']['extrusions'] == source['sketchModel']['extrusions']
    assert suppressed['sketchModel']['suppressedFeatures'] == [{
        'featureId': feature['id'],
        'output': {key: original[key] for key in ('name', 'color', 'visible')},
    }]
    assert all(body['id'] != body_id for body in suppressed['exactModel']['bodies'])

    tabs = page.get_by_role('tablist', name='Документы')
    tab_count = tabs.get_by_role('tab').count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'suppressed-extrusion.json')
    )
    expect(tabs.get_by_role('tab')).to_have_count(tab_count + 1, timeout=120000)
    expect(row).to_contain_text('Подавлено')
    expect(body_row(page, body_id)).to_have_count(0)
    row.click()
    confirm_action(page, 'Возобновить операцию', 'Возобновление операции', 'Возобновить')
    expect(body_row(page, body_id)).to_have_count(1, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(24, rel=1e-9)
    resumed = save_document(page, tmp_path, 'resumed-extrusion.json')
    assert not resumed['sketchModel'].get('suppressedFeatures')
    assert resumed['sketchModel']['extrusions'] == source['sketchModel']['extrusions']
    result = next(body for body in resumed['exactModel']['bodies'] if body['id'] == body_id)
    for key in ('name', 'color', 'visible'):
        assert result[key] == original[key]


def test_branch_with_already_suppressed_fusion_cannot_be_suppressed(page, tmp_path):
    prepare(page)
    create_sketch(page)
    extrude(page)
    source = save_document(page, tmp_path, 'fusion-extrusion.json')
    feature = source['sketchModel']['extrusions'][0]
    operand = box(page, tmp_path, origin=(1, 0, 0))
    fusion = fuse(page, tmp_path, feature['bodyId'], operand)
    history_feature(page, 'fusion', fusion['id']).click()
    confirm_action(page, 'Подавить операцию', 'Подавление операции', 'Подавить')
    before = save_document(page, tmp_path, 'before-blocked-suppression.json')
    history_feature(page, 'extrusion', feature['id']).click()
    controls = page.get_by_role('region', name='Подавление операции', exact=True)
    expect(controls.get_by_role('button', name='Подавить операцию', exact=True)).to_be_disabled()
    assert save_document(page, tmp_path, 'after-blocked-suppression.json') == before
