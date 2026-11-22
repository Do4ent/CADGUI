"""A distance mate constrains occurrence origins across parent frames."""

import pytest
from playwright.sync_api import expect

from test_assembly_groups import add_subassembly
from test_assembly_mates import assert_world_pose
from test_cross_parent_assembly_mates import add_group_occurrence, reposition_group
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def test_distance_mate_create_edit_and_reopen(page, tmp_path):
    prepare(page)
    create_box(page)
    source = save_document(page, tmp_path, 'distance-source.json')['exactModel']
    source_id = source['bodies'][0]['id']
    page.get_by_role('button', name='Сборка', exact=True).click()
    leader_group = add_subassembly(page, 'Привод', [10, 20, 3])
    follower_group = add_subassembly(page, 'Рама', [10, 30, 3])
    leader = add_group_occurrence(page, source_id, leader_group, 'Ведущий', 1, 0)
    follower = add_group_occurrence(page, source_id, follower_group, 'Ведомый', 1, 30)
    assert_world_pose(page, leader, [10, 21, 3], 90)
    assert_world_pose(page, follower, [10, 31, 3], 120)

    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    panel.get_by_role('button', name='Создать сопряжение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    dialog.get_by_label('Тип сопряжения', exact=True).select_option('distance')
    dialog = page.get_by_role('dialog', name='Сопряжение по расстоянию', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    value = dialog.get_by_label('Расстояние (мм)', exact=True)
    confirm = dialog.get_by_role('button', name='ОК', exact=True)
    value.fill('-1')
    expect(confirm).to_be_disabled()
    value.fill('18')
    assert_world_pose(page, follower, [10, 31, 3], 120)
    confirm.click()
    expect(dialog).not_to_be_visible()
    assert_world_pose(page, follower, [10, 39, 3], 120)

    reposition_group(page, leader_group, 30, 180)
    assert_world_pose(page, leader, [29, 20, 3], 180)
    assert_world_pose(page, follower, [11, 20, 3], 210)
    edit = panel.get_by_role('button', name='Изменить расстояние', exact=True)
    edit.click()
    editor = page.get_by_role('dialog', name='Расстояние сопряжения', exact=True)
    value = editor.get_by_label('Расстояние (мм)', exact=True)
    expect(value).to_have_value('18')
    value.fill('6')
    editor.get_by_role('button', name='ОК', exact=True).click()
    expect(editor).not_to_be_visible()
    assert_world_pose(page, follower, [23, 20, 3], 210)

    file_name = 'distance-mate.json'
    saved = save_document(page, tmp_path, file_name)
    assert saved['schemaVersion'] == 20
    assert saved['exactModel'] == source
    (mate,) = saved['assemblyFixedMates']
    assert (mate['leaderId'], mate['followerId']) == (leader, follower)
    assert mate['distance'] == 6
    assert mate['direction'] == pytest.approx([1, 0, 0], abs=1e-8)
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tab_count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(str(tmp_path / file_name))
    expect(tabs).to_have_count(tab_count + 1, timeout=120000)
    assert_world_pose(page, follower, [23, 20, 3], 210)

    detach = panel.get_by_role('button', name='Отсоединить сопряжение', exact=True)
    detach.click()
    page.get_by_role('dialog', name='Отсоединить сопряжение', exact=True).get_by_role(
        'button', name='ОК', exact=True
    ).click()
    expect(detach).to_have_count(0)
    assert_world_pose(page, follower, [23, 20, 3], 210)
    detached = save_document(page, tmp_path, 'distance-detached.json')
    assert detached['assemblyFixedMates'] == []
    pose = next(item for item in detached['assemblyInstances'] if item['id'] == follower)
    assert pose['parentId'] == follower_group
    assert pose['position'] == pytest.approx([-10, -13, 0], abs=1e-8)

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(edit).to_have_count(1)
    assert_world_pose(page, follower, [23, 20, 3], 210)
    assert save_document(page, tmp_path, 'distance-undo.json')['assemblyFixedMates'] == [mate]
