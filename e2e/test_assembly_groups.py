"""Nested subassemblies compose local placements and preserve document history."""

import json

import pytest
from playwright.sync_api import expect

from test_assembly_instances import add_occurrence
from test_assembly_mates import assert_world_pose
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def add_subassembly(page, name, position, parent_id=None):
    panel = page.get_by_role('region', name='Подсборки', exact=True)
    panel.get_by_role('button', name='Добавить подсборку', exact=True).click()
    dialog = page.get_by_role('dialog', name='Подсборка', exact=True)
    dialog.get_by_label('Имя подсборки', exact=True).fill(name)
    if parent_id:
        dialog.get_by_label('Родительская подсборка', exact=True).select_option(parent_id)
    for axis, value in zip('XYZ', position):
        dialog.get_by_label(f'Смещение {axis}', exact=True).fill(str(value))
    dialog.get_by_label('Поворот Z', exact=True).fill('90')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    return panel.locator('[data-assembly-group]').filter(has_text=name).get_attribute('data-assembly-group')


def test_nested_subassembly_move_undo_and_reopen(page, tmp_path):
    prepare(page)
    create_box(page)
    source = save_document(page, tmp_path, 'nested-source.json')['exactModel']
    page.get_by_role('button', name='Сборка', exact=True).click()
    parent = add_subassembly(page, 'Модуль', [10, 20, 3])
    child = add_subassembly(page, 'Редуктор', [5, 0, 2], parent)
    add_occurrence(page, source['bodies'][0]['id'], 'Вал', [2, 1, 4], [0, 0, 0])
    before = save_document(page, tmp_path, 'nested-before.json')
    (occurrence,) = before['assemblyInstances']
    instance = occurrence['id']
    row = page.locator(f'[data-assembly-occurrence="{instance}"]')
    parent_row = page.locator(f'[data-assembly-group="{parent}"]')
    child_row = page.locator(f'[data-assembly-group="{child}"]')

    def assert_path(locator, path):
        expect(locator).to_have_attribute('data-assembly-path', json.dumps(path, separators=(',', ':')))

    assert_path(parent_row, [parent])
    assert_path(child_row, [parent, child])
    assert_path(row, [instance])
    assert_world_pose(page, instance, [2, 1, 4], 0)

    row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    edit = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    edit.get_by_label('Родительская подсборка', exact=True).select_option(child)
    edit.get_by_role('button', name='ОК', exact=True).click()
    expect(edit).not_to_be_visible()
    assert_path(row, [parent, child, instance])
    assert_world_pose(page, instance, [2, 1, 4], 0)
    reparented = save_document(page, tmp_path, 'nested-reparented.json')['assemblyInstances'][0]
    assert reparented['parentId'] == child
    assert reparented['position'] == pytest.approx([8, 24, -1])

    row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    for axis, value in zip('XYZ', occurrence['position']):
        edit.get_by_label(f'Смещение {axis}', exact=True).fill(str(value))
        edit.get_by_label(f'Поворот {axis}', exact=True).fill('0')
    edit.get_by_role('button', name='ОК', exact=True).click()
    expect(edit).not_to_be_visible()
    assert_world_pose(page, instance, [8, 24, 9], 180)

    parent_row.get_by_role('button', name='Изменить подсборку', exact=True).click()
    group_edit = page.get_by_role('dialog', name='Подсборка', exact=True)
    parent_picker = group_edit.get_by_label('Родительская подсборка', exact=True)
    expect(parent_picker.locator(f'option[value="{child}"]')).to_have_count(0)
    expect(parent_picker.locator(f'option[value="{parent}"]')).to_have_count(0)
    group_edit.get_by_role('button', name='Отмена', exact=True).click()
    expect(group_edit).not_to_be_visible()

    nested = save_document(page, tmp_path, 'nested-saved.json')
    assert nested['schemaVersion'] == 18
    assert nested['exactModel'] == source
    assert nested['assemblyGroups'] == before['assemblyGroups']
    assert nested['assemblyInstances'] == [{**occurrence, 'parentId': child}]
    groups = {group['id']: group for group in nested['assemblyGroups']}
    assert not groups[parent].get('parentId')
    assert groups[child]['parentId'] == parent
    assert groups[child]['position'] == [5, 0, 2]

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    assert_world_pose(page, instance, [2, 1, 4], 0)
    assert_path(row, [parent, child, instance])
    page.keyboard.press('Control+z')
    assert_path(row, [instance])
    assert_world_pose(page, instance, [2, 1, 4], 0)
    assert save_document(page, tmp_path, 'nested-undo.json')['assemblyInstances'] == [occurrence]
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+y')
    assert_path(row, [parent, child, instance])
    assert_world_pose(page, instance, [2, 1, 4], 0)
    page.keyboard.press('Control+y')
    assert_world_pose(page, instance, [8, 24, 9], 180)

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    count = tabs.count()
    file_input = page.get_by_label('Импорт документа JSON', exact=True)
    file_input.set_input_files(str(tmp_path / 'nested-saved.json'))
    expect(tabs).to_have_count(count + 1, timeout=120000)
    assert_path(row, [parent, child, instance])
    assert_world_pose(page, instance, [8, 24, 9], 180)
    reopened = save_document(page, tmp_path, 'nested-reopened.json')
    for field in ('assemblyGroups', 'assemblyInstances', 'exactModel'):
        assert reopened[field] == nested[field]

    invalid_file = tmp_path / 'nested-cycle.json'
    invalid_groups = [
        {**group, 'parentId': child} if group['id'] == parent else group
        for group in nested['assemblyGroups']
    ]
    invalid_file.write_text(json.dumps({**nested, 'assemblyGroups': invalid_groups}), encoding='utf-8')
    file_input.set_input_files(str(invalid_file))
    expect(page.get_by_role('alert').filter(has_text='Ошибка открытия JSON')).to_be_visible()
    expect(tabs).to_have_count(count + 1)
    assert_path(row, [parent, child, instance])
    assert_world_pose(page, instance, [8, 24, 9], 180)
