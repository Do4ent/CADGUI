"""Global command routes use the real linked-operation dialog and OCCT."""
import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_kernel import prepare
from test_body_booleans import cube, document
from test_sketch import inspect

@pytest.mark.parametrize('operation,label,route', [
    ('common', 'Пересечение тел', 'ribbon'),
    ('cut', 'Вычитание тел', 'search'),
])
def test_global_body_boolean_routes(page, tmp_path, operation, label, route):
    prepare(page)
    command = page.locator('.context-ribbon-strip').get_by_role('button', name=label, exact=True)
    expect(command).to_be_disabled()
    a = cube(page, tmp_path)
    expect(command).to_be_disabled()
    b = cube(page, tmp_path, x=1)
    expect(command).to_be_enabled()
    before = document(page, tmp_path, 'before-routing.json')
    def invoke():
        if route == 'ribbon':
            command.click()
        else:
            search = page.get_by_label('Поиск команд', exact=True)
            search.fill(label)
            page.get_by_role('option').filter(has_text=label).click()
        return page.get_by_role('dialog', name=label, exact=True)
    dialog = invoke()
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert document(page, tmp_path, 'cancel-routing.json') == before
    dialog = invoke()
    dialog.get_by_label('Тело A', exact=True).select_option(a)
    dialog.get_by_label('Тело B', exact=True).select_option(b)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    feature = document(page, tmp_path)['sketchModel']['bodyBooleans'][-1]
    assert feature['operation'] == operation
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(4, rel=1e-7)
