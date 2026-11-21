"""Grouped suppression and recovery through the CAD interface."""

import pytest
from playwright.sync_api import expect

from test_drawing import save_document
from test_feature_suppression import body_row, confirm_action, history_feature
from test_fusion import open_fusion
from test_kernel import create_box, prepare
from test_regression import browser, page
from test_sketch import create_sketch, extrude, inspect


def test_suppress_and_resume_extrusion_fusion_branch_atomically(page, tmp_path):
    prepare(page)
    create_sketch(page, width=2, height=3)
    extrude(page, depth=4)
    source = save_document(page, tmp_path, 'extrusion.json')
    extrusion = source['sketchModel']['extrusions'][0]
    base_id = extrusion['bodyId']

    create_box(page, size=(2, 3, 4), origin=(1, 0, 0))
    with_operand = save_document(page, tmp_path, 'with-operand.json')
    operand_id = next(body['id'] for body in with_operand['exactModel']['bodies'] if body['id'] != base_id)
    dialog = open_fusion(page, base_id, operand_id)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    original = save_document(page, tmp_path, 'active-branch.json')
    fusion = original['sketchModel']['fusions'][0]
    output_id = fusion['bodyId']
    original_bodies = {body['id']: body for body in original['exactModel']['bodies']}

    root = history_feature(page, 'extrusion', extrusion['id'])
    descendant = history_feature(page, 'fusion', fusion['id'])
    root.click()
    controls = page.get_by_role('region', name='Подавление операции', exact=True)
    controls.get_by_role('button', name='Подавить операцию', exact=True).click()
    page.get_by_role('dialog', name='Подавление операции', exact=True).get_by_role(
        'button', name='Отмена', exact=True,
    ).click()
    assert save_document(page, tmp_path, 'after-cancel.json') == original
    confirm_action(page, 'Подавить операцию', 'Подавление операции', 'Подавить')
    expect(root).to_contain_text('Подавлено')
    expect(descendant).to_contain_text('Подавлено')
    expect(body_row(page, base_id)).to_have_count(0)
    expect(body_row(page, output_id)).to_have_count(0)
    suppressed = save_document(page, tmp_path, 'suppressed-branch.json')
    assert suppressed['schemaVersion'] == 14
    records = suppressed['sketchModel']['suppressedFeatures']
    assert {record['featureId'] for record in records} == {extrusion['id'], fusion['id']}
    assert {record['groupId'] for record in records} == {extrusion['id']}
    assert suppressed['exactModel']['bodies'] == [{**original_bodies[operand_id], 'visible': True}]

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(body_row(page, base_id)).to_have_count(1)
    expect(body_row(page, output_id)).to_have_count(1)
    undone = save_document(page, tmp_path, 'undone-branch.json')
    assert undone['exactModel'] == original['exactModel']
    assert undone['sketchModel'] == original['sketchModel']
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+y')
    expect(body_row(page, base_id)).to_have_count(0)
    expect(body_row(page, output_id)).to_have_count(0)
    redone = save_document(page, tmp_path, 'redone-branch.json')
    assert redone['exactModel'] == suppressed['exactModel']
    assert redone['sketchModel'] == suppressed['sketchModel']

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tab_count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'suppressed-branch.json')
    )
    expect(tabs).to_have_count(tab_count + 1, timeout=120000)
    expect(root).to_contain_text('Подавлено')
    expect(descendant).to_contain_text('Подавлено')
    root.click()
    confirm_action(page, 'Возобновить операцию', 'Возобновление операции', 'Возобновить')
    assert inspect(page, base_id)['volume'] == pytest.approx(24, rel=1e-9)
    assert inspect(page, output_id)['volume'] == pytest.approx(36, rel=1e-9)
    resumed = save_document(page, tmp_path, 'resumed-branch.json')
    assert not resumed['sketchModel'].get('suppressedFeatures')
    for collection in ('extrusions', 'fusions'):
        assert resumed['sketchModel'][collection] == original['sketchModel'][collection]
    assert {body['id']: {key: body[key] for key in ('name', 'color', 'visible')}
            for body in resumed['exactModel']['bodies']} == {
        body_id: {key: body[key] for key in ('name', 'color', 'visible')}
        for body_id, body in original_bodies.items()
    }
