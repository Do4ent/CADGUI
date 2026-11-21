"""Reorder adjacent sibling operations through the modeling history."""

import pytest
from playwright.sync_api import expect

from test_body_booleans import boolean, cube, document
from test_feature_suppression import history_feature
from test_kernel import prepare
from test_regression import browser, page
from test_sketch import inspect


def test_reorder_siblings_cancel_commit_undo_redo_and_reopen(page, tmp_path):
    prepare(page)
    a, b = cube(page, tmp_path), cube(page, tmp_path, x=1)
    common = boolean(page, tmp_path, 'common', a, b)
    cut = boolean(page, tmp_path, 'cut', a, b)
    original = document(page, tmp_path, 'order-before.json')

    item = history_feature(page, 'body-boolean', cut['id'])
    item.click()
    controls = page.get_by_role('region', name='Порядок перестроения')
    earlier = controls.get_by_role('button', name='Переместить раньше')
    later = controls.get_by_role('button', name='Переместить позже')
    expect(earlier).to_be_enabled()
    expect(later).to_be_disabled()
    dialog = page.get_by_role('dialog', name='Изменение порядка перестроения')
    earlier.click()
    dialog.get_by_role('button', name='Отмена').click()
    assert document(page, tmp_path, 'order-cancel.json') == original
    earlier.click()
    dialog.get_by_role('button', name='Перестроить').click()
    expect(later).to_be_enabled(timeout=120000)
    reordered = document(page, tmp_path, 'order-reordered.json')
    assert reordered['sketchModel']['bodyBooleans'] == [cut, common]
    assert {body['id'] for body in reordered['exactModel']['bodies']} == {
        body['id'] for body in original['exactModel']['bodies']
    }

    def history_order():
        return page.locator('[data-history-id^="body-boolean:"]').evaluate_all(
            '(nodes) => nodes.map(node => node.dataset.historyId.split(":")[1])'
        )

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(page.locator('[data-history-id^="body-boolean:"]').first).to_have_attribute(
        'data-history-id', f'body-boolean:{common["id"]}'
    )
    assert history_order() == [common['id'], cut['id']]
    undone = document(page, tmp_path, 'order-undone.json')
    assert undone['sketchModel'] == original['sketchModel']
    assert undone['exactModel'] == original['exactModel']
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+y')
    assert document(page, tmp_path, 'order-redone.json')['sketchModel'] == reordered['sketchModel']

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tab_count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'order-reordered.json')
    )
    expect(tabs).to_have_count(tab_count + 1, timeout=120000)
    assert history_order() == [cut['id'], common['id']]
    assert inspect(page, cut['bodyId'])['volume'] == pytest.approx(4)
    assert inspect(page, common['bodyId'])['volume'] == pytest.approx(4)
