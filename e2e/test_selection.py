"""Set-based tree selection and single-transaction mutation regressions."""
from playwright.sync_api import expect
from test_regression import browser, page, items


def row(page, identifier):
    return page.locator(f'[role="treeitem"][data-tree-id="{identifier}"]')


def selected(page):
    return page.locator('[role="treeitem"][aria-selected="true"]').evaluate_all('(nodes) => nodes.map(n => n.dataset.treeId)')


def command(page, name):
    search = page.locator('.command-search input')
    search.fill(name)
    search.press('Enter')
    search.blur()


def select_pair(page):
    row(page, 'body').click()
    row(page, 'cover').click(modifiers=['Control'])
    assert set(selected(page)) == {'body', 'cover'}


def test_ctrl_toggle_and_shift_range_follow_visible_tree_order(page):
    select_pair(page)
    row(page, 'body').click(modifiers=['Control'])
    assert selected(page) == ['cover']
    order = page.locator('[role="treeitem"]').evaluate_all('(nodes) => nodes.map(n => n.dataset.treeId)')
    row(page, order[1]).click()
    row(page, order[4]).click(modifiers=['Shift'])
    assert set(selected(page)) == set(order[1:5])


def test_hide_set_and_isolate_each_undo_as_one_transaction(page):
    before = items(page)
    select_pair(page)
    command(page, 'Скрыть')
    page.wait_for_function('() => JSON.parse(localStorage.getItem("bendcore-items")).filter(x => !x.visible).length === 2')
    assert {x['id'] for x in items(page) if not x['visible']} == {'body', 'cover'}
    page.keyboard.press('Control+z')
    page.wait_for_function('() => JSON.parse(localStorage.getItem("bendcore-items")).every(x => x.visible)')
    assert items(page) == before
    select_pair(page)
    command(page, 'Изолировать')
    page.wait_for_function('() => JSON.parse(localStorage.getItem("bendcore-items")).filter(x => x.visible).length === 2')
    assert {x['id'] for x in items(page) if x['visible']} == {'body', 'cover'}
    page.keyboard.press('Control+z')
    page.wait_for_function('() => JSON.parse(localStorage.getItem("bendcore-items")).every(x => x.visible)')
    assert items(page) == before


def test_duplicate_and_delete_apply_to_entire_selection(page):
    before = items(page)
    select_pair(page)
    command(page, 'Дублировать')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before) + 2)
    copies = set(selected(page))
    assert len(copies) == 2
    assert copies.isdisjoint({x['id'] for x in before})
    command(page, 'Удалить')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before))
    assert items(page) == before
    page.keyboard.press('Control+z')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=len(before) + 2)
    assert copies.issubset({x['id'] for x in items(page)})
