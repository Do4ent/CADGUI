"""Confirmation and keyboard regressions for parameterized prototype commands."""
import pytest
from playwright.sync_api import expect

from test_regression import browser, page, items


def open_box(page):
    search = page.locator('.command-search input')
    search.fill('Добавить блок')
    search.press('Enter')
    dialog = page.get_by_role('dialog', name='Добавить блок', exact=True)
    expect(dialog).to_be_visible()
    return dialog


def test_open_and_escape_do_not_mutate_model(page):
    before = items(page)
    dialog = open_box(page)
    assert items(page) == before
    dialog.get_by_label('Ширина', exact=True).fill('25')
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    assert items(page) == before


def test_confirm_creates_one_part_and_supports_undo_redo(page):
    before = items(page)
    dialog = open_box(page)
    dialog.get_by_label('Ширина', exact=True).fill('2')
    dialog.get_by_label('Высота', exact=True).fill('3')
    dialog.get_by_label('Глубина', exact=True).fill('4')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before) + 1)
    added = items(page)[-1]
    assert added['kind'] == 'box'
    assert added['size'] == [2, 3, 4]
    page.locator('.command-search input').blur()
    page.keyboard.press('Control+z')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before))
    page.keyboard.press('Control+y')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before) + 1)
    assert items(page)[-1] == added


def test_invalid_dimension_cannot_confirm_and_shortcuts_stay_in_dialog(page):
    before = items(page)
    dialog = open_box(page)
    width = dialog.get_by_label('Ширина', exact=True)
    width.fill('-1')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    width.press('Delete')
    width.press('Control+d')
    assert items(page) == before
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert items(page) == before


@pytest.mark.parametrize('theme', ['dark', 'light'])
def test_dialog_square_controls_and_keyboard_focus_in_both_themes(page, theme):
    page.evaluate('(theme) => localStorage.setItem("bendcore-theme", theme)', theme)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    dialog = open_box(page)
    assert dialog.evaluate('(el) => getComputedStyle(el).borderRadius') == '0px'
    assert dialog.locator('input, button').evaluate_all('(elements) => elements.every(el => getComputedStyle(el).borderRadius === "0px")')
    assert dialog.evaluate('(el) => el.contains(document.activeElement)')
    for _ in range(10):
        page.keyboard.press('Tab')
        assert dialog.evaluate('(el) => el.contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
