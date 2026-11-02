"""Additional end-to-end regression coverage for the UI-only CAD prototype.

Run after starting Vite: BENDCORE_URL=http://127.0.0.1:4173
python -m pytest e2e/test_ui.py e2e/test_regression.py -v
"""
import json
import os

import pytest
from playwright.sync_api import sync_playwright

BASE = os.getenv("BENDCORE_URL", "http://127.0.0.1:5173")
UI_KEY = "bendcore-ui-v25"
ITEMS_KEY = "bendcore-items"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        instance = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        yield instance
        instance.close()


@pytest.fixture
def page(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.add_init_script(
        """() => {
          localStorage.removeItem('bendcore-ui-v25');
          localStorage.removeItem('bendcore-items');
          localStorage.removeItem('bendcore-theme');
          localStorage.removeItem('bendcore-dock-v1');
        }"""
    )
    page = context.new_page()
    page.goto(BASE, wait_until="domcontentloaded")
    page.locator(".environment-panel").wait_for()
    yield page
    context.close()


def items(page):
    return page.evaluate("JSON.parse(localStorage.getItem('bendcore-items'))")


def test_initial_model_and_tree_match(page):
    page.wait_for_function("JSON.parse(localStorage.getItem('bendcore-items') || 'null')?.length === 8")
    data = items(page)
    assert len(data) == 8
    assert len({part["id"] for part in data}) == len(data)
    assert page.locator('[role="treeitem"]').count() == len(data)
    assert all(part["visible"] for part in data)


@pytest.mark.parametrize("shortcut,environment", [
    ("Alt+1", "Модель"),
    ("Alt+2", "Сборка"),
    ("Alt+3", "Эскиз"),
    ("Alt+4", "Чертёж"),
])
def test_environment_switch_updates_persistent_state(page, shortcut, environment):
    page.keyboard.press(shortcut)
    panel = page.locator(".environment-panel")
    assert panel.get_attribute("aria-label") == f"Параметры среды {environment}"
    page.wait_for_function(
        "(expected) => JSON.parse(localStorage.getItem('bendcore-ui-v25') || '{}').tab === expected",
        environment,
    )
    page.reload(wait_until="domcontentloaded")
    assert page.locator(".environment-panel").get_attribute("aria-label") == f"Параметры среды {environment}"


def test_tree_selection_updates_context_panel(page):
    target = page.locator('[role="treeitem"][data-tree-id="gear1"]')
    target.click()
    assert target.get_attribute("aria-selected") == "true"
    assert "Ведущая шестерня" in page.locator(".environment-panel-summary").inner_text()
    assert page.locator('[data-property-editor="true"]').count() == 1


def test_hide_and_show_component_persists(page):
    target = page.locator('[role="treeitem"][data-tree-id="gear1"]')
    target.locator('button[title="Скрыть"]').click()
    page.wait_for_function(
        "() => JSON.parse(localStorage.getItem('bendcore-items') || '[]').find(x => x.id === 'gear1')?.visible === false"
    )
    page.reload(wait_until="domcontentloaded")
    assert next(x for x in items(page) if x["id"] == "gear1")["visible"] is False
    page.locator('[role="treeitem"][data-tree-id="gear1"] button[title="Показать"]').click()
    page.wait_for_function(
        "() => JSON.parse(localStorage.getItem('bendcore-items') || '[]').find(x => x.id === 'gear1')?.visible === true"
    )


def test_corrupt_ui_settings_recover_without_crashing(page):
    page.evaluate("localStorage.setItem('bendcore-ui-v25', '{invalid json')")
    page.reload(wait_until="domcontentloaded")
    assert page.locator(".environment-panel").count() == 1
    assert page.locator('[role="treeitem"]').count() == 8


def test_corrupt_items_recover_to_demo_model(page):
    page.evaluate("localStorage.setItem('bendcore-items', '{invalid json')")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("JSON.parse(localStorage.getItem('bendcore-items') || 'null')?.length === 8")
    assert page.locator('[role="treeitem"]').count() == 8


def test_command_search_opens_and_closes(page):
    page.keyboard.press("Control+k")
    assert page.locator("input:focus").count() == 1
    page.keyboard.press("Escape")
    assert page.locator("input:focus").count() == 0


def test_keyboard_property_editor_focus(page):
    tree = page.locator('[role="tree"]')
    tree.focus()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")
    page.keyboard.press("F4")
    assert page.evaluate("!!document.activeElement?.closest('[data-property-editor]')")


def test_no_uncaught_page_errors_on_environment_switch(page):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for key in ["Alt+1", "Alt+2", "Alt+3", "Alt+4"]:
        page.keyboard.press(key)
        assert page.locator(".environment-panel").count() == 1
    assert not errors, "\n".join(errors)
