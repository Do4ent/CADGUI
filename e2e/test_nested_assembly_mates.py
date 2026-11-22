"""Fixed mates solve in the shared local frame of a nested assembly."""

import pytest
from playwright.sync_api import expect

from test_assembly_groups import add_subassembly
from test_assembly_instances import add_occurrence
from test_assembly_mates import assert_world_pose
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def test_nested_fixed_mate_follows_local_leader_and_parent(page, tmp_path):
    prepare(page)
    create_box(page)
    source = save_document(page, tmp_path, 'source.json')['exactModel']
    source_id = source['bodies'][0]['id']
    page.get_by_role('button', name='Сборка', exact=True).click()
    parent = add_subassembly(page, 'Модуль', [10, 20, 3])
    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    add_occurrence(page, source_id, 'Корневое вхождение', [0, 0, 0], [0, 0, 0])

    def add_sibling(name, shift, angle):
        panel.get_by_role('button', name='Добавить вхождение', exact=True).click()
        editor = page.get_by_role('dialog', name='Вхождение детали', exact=True)
        editor.get_by_label('Исходное тело', exact=True).select_option(source_id)
        editor.get_by_label('Имя вхождения', exact=True).fill(name)
        editor.get_by_label('Родительская подсборка', exact=True).select_option(parent)
        editor.get_by_label('Смещение X', exact=True).fill(str(shift))
        editor.get_by_label('Поворот Z', exact=True).fill(str(angle))
        editor.get_by_role('button', name='ОК', exact=True).click()
        expect(editor).not_to_be_visible()

    add_sibling('Ведущий вал', 1, 0)
    create_mate = panel.get_by_role('button', name='Создать сопряжение', exact=True)
    expect(create_mate).to_be_enabled()
    add_sibling('Ведомый вал', 5, 30)
    before = save_document(page, tmp_path, 'before.json')
    outside, leader, follower = [item['id'] for item in before['assemblyInstances']]
    assert_world_pose(page, leader, [10, 21, 3], 90)
    assert_world_pose(page, follower, [10, 25, 3], 120)

    create_mate.click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    leader_picker = dialog.get_by_label('Ведущее вхождение', exact=True)
    follower_picker = dialog.get_by_label('Ведомое вхождение', exact=True)
    expect(leader_picker.locator(f'option[value="{outside}"]')).to_have_count(1)
    leader_picker.select_option(leader)
    expect(follower_picker.locator(f'option[value="{outside}"]')).to_have_count(1)
    follower_picker.select_option(follower)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(create_mate).to_be_enabled()
    assert_world_pose(page, follower, [10, 25, 3], 120)

    leader_row = page.locator(f'[data-assembly-occurrence="{leader}"]')
    leader_row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    editor = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    expect(editor.get_by_label('Родительская подсборка', exact=True)).to_be_disabled()
    editor.get_by_label('Смещение X', exact=True).fill('3')
    editor.get_by_label('Поворот Z', exact=True).fill('90')
    editor.get_by_role('button', name='ОК', exact=True).click()
    expect(editor).not_to_be_visible()
    assert_world_pose(page, leader, [10, 23, 3], 180)
    assert_world_pose(page, follower, [6, 23, 3], 210)

    group = page.locator(f'[data-assembly-group="{parent}"]')
    group.get_by_role('button', name='Изменить подсборку', exact=True).click()
    group_editor = page.get_by_role('dialog', name='Подсборка', exact=True)
    group_editor.get_by_label('Смещение X', exact=True).fill('20')
    group_editor.get_by_role('button', name='ОК', exact=True).click()
    expect(group_editor).not_to_be_visible()
    assert_world_pose(page, leader, [20, 23, 3], 180)
    assert_world_pose(page, follower, [16, 23, 3], 210)
    assert_world_pose(page, outside, [0, 0, 0], 0)

    saved = save_document(page, tmp_path, 'linked.json')
    assert saved['schemaVersion'] == 21
    assert saved['exactModel'] == source
    (mate,) = saved['assemblyFixedMates']
    assert (mate['leaderId'], mate['followerId']) == (leader, follower)
    assert mate['translation'] == pytest.approx([4, 0, 0])

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'linked.json')
    )
    expect(tabs).to_have_count(count + 1, timeout=120000)
    assert_world_pose(page, follower, [16, 23, 3], 210)
    assert save_document(page, tmp_path, 'reopened.json')['assemblyFixedMates'] == [mate]

    detach = panel.get_by_role('button', name='Отсоединить сопряжение', exact=True)
    detach.click()
    page.get_by_role('dialog', name='Отсоединить сопряжение', exact=True).get_by_role(
        'button', name='ОК', exact=True
    ).click()
    expect(detach).to_have_count(0)
    assert_world_pose(page, follower, [16, 23, 3], 210)
    detached = save_document(page, tmp_path, 'detached.json')
    assert detached.get('assemblyFixedMates', []) == []
    pose = next(item for item in detached['assemblyInstances'] if item['id'] == follower)
    assert pose['parentId'] == parent
    assert pose['position'] == pytest.approx([3, 4, 0])

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(detach).to_have_count(1)
    assert_world_pose(page, follower, [16, 23, 3], 210)
    assert save_document(page, tmp_path, 'undo-detach.json')['assemblyFixedMates'] == [mate]
