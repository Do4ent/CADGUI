"""Assembly placement of multiple occurrences of one real exact body."""

import json

import pytest
from playwright.sync_api import expect

from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page
from test_sketch import create_sketch, edit_width, extrude, inspect


def instance_marker(page, instance_id):
    return page.locator(f'[data-assembly-instance="{instance_id}"]').first


def add_occurrence(page, source_id, name, position, rotation):
    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    panel.get_by_role('button', name='Добавить вхождение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    dialog.get_by_label('Исходное тело', exact=True).select_option(source_id)
    dialog.get_by_label('Имя вхождения', exact=True).fill(name)
    for axis, shift, angle in zip('XYZ', position, rotation):
        dialog.get_by_label(f'Смещение {axis}', exact=True).fill(str(shift))
        dialog.get_by_label(f'Поворот {axis}', exact=True).fill(str(angle))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()


def test_assembly_occurrences_share_source_with_independent_placement_and_reopen(page, tmp_path):
    prepare(page)
    create_box(page)
    before = save_document(page, tmp_path, 'assembly-source.json')
    source_id = before['exactModel']['bodies'][0]['id']
    page.get_by_role('button', name='Сборка', exact=True).click()

    add_occurrence(page, source_id, 'Первая копия', [8, 0, 1], [0, 0, 0])
    add_occurrence(page, source_id, 'Вторая копия', [-6, 7, 2], [15, -30, 90])
    saved = save_document(page, tmp_path, 'assembly-occurrences.json')
    assert saved['schemaVersion'] == 18
    assert saved['exactModel'] == before['exactModel']
    occurrences = saved['assemblyInstances']
    assert len(occurrences) == 2
    assert len({occurrence['id'] for occurrence in occurrences}) == 2
    by_name = {occurrence['name']: occurrence for occurrence in occurrences}
    for name, position, rotation in (
        ('Первая копия', [8, 0, 1], [0, 0, 0]),
        ('Вторая копия', [-6, 7, 2], [15, -30, 90]),
    ):
        occurrence = by_name[name]
        assert occurrence['sourceBodyId'] == source_id
        assert occurrence['position'] == position
        assert occurrence['rotation'] == rotation
        expect(page.locator(f'[data-assembly-occurrence="{occurrence["id"]}"]')).to_contain_text(name)
        marker = instance_marker(page, occurrence['id'])
        expect(marker).to_be_attached(timeout=120000)
        assert json.loads(marker.get_attribute('data-assembly-position')) == position
        assert json.loads(marker.get_attribute('data-assembly-rotation')) == rotation

    second = by_name['Вторая копия']
    second_row = page.locator(f'[data-assembly-occurrence="{second["id"]}"]')
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(second_row).to_have_count(0)
    undone = save_document(page, tmp_path, 'assembly-undo.json')
    assert undone['assemblyInstances'] == [by_name['Первая копия']]
    assert undone['exactModel'] == before['exactModel']
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+y')
    expect(second_row).to_have_count(1)
    redone = save_document(page, tmp_path, 'assembly-redo.json')
    assert redone['assemblyInstances'] == occurrences

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'assembly-occurrences.json')
    )
    expect(tabs).to_have_count(count + 1, timeout=120000)
    reopened = save_document(page, tmp_path, 'assembly-reopened.json')
    assert reopened['assemblyInstances'] == occurrences
    assert len(reopened['exactModel']['bodies']) == 1
    for occurrence in occurrences:
        expect(page.locator(f'[data-assembly-instance="{occurrence["id"]}"]').first).to_be_attached(
            timeout=120000
        )

    second_row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    dialog.get_by_label('Смещение X', exact=True).fill('11')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(dialog).not_to_be_visible()
    assert save_document(page, tmp_path, 'assembly-edit-canceled.json')['assemblyInstances'] == occurrences

    second_row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    dialog.get_by_label('Смещение X', exact=True).fill('11')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    moved = save_document(page, tmp_path, 'assembly-moved.json')
    assert moved['assemblyInstances'] == [
        by_name['Первая копия'],
        {**second, 'position': [11, 7, 2]},
    ]
    assert moved['exactModel'] == reopened['exactModel']


def test_both_occurrences_refresh_from_one_rebuilt_parametric_source(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page, width=2, height=3)
    extrude(page, depth=4)
    source = save_document(page, tmp_path, 'assembly-parametric-source.json')
    body_id = source['sketchModel']['extrusions'][0]['bodyId']
    page.get_by_role('button', name='Сборка', exact=True).click()
    add_occurrence(page, body_id, 'Левое вхождение', [8, 0, 0], [0, 0, 0])
    add_occurrence(page, body_id, 'Правое вхождение', [-8, 0, 0], [0, 0, 90])
    initial = save_document(page, tmp_path, 'assembly-before-rebuild.json')
    markers = [instance_marker(page, occurrence['id']) for occurrence in initial['assemblyInstances']]
    for marker in markers:
        expect(marker).to_be_attached(timeout=120000)
    previous_generation = markers[0].get_attribute('data-assembly-mesh-generation')
    assert previous_generation
    expect(markers[1]).to_have_attribute('data-assembly-mesh-generation', previous_generation)

    page.get_by_role('button', name='Модель', exact=True).click()
    edit_width(page, sketch_id, 5)
    assert inspect(page, body_id)['volume'] == pytest.approx(60, rel=1e-9)
    rebuilt = save_document(page, tmp_path, 'assembly-after-rebuild.json')
    assert rebuilt['assemblyInstances'] == initial['assemblyInstances']
    assert [body['id'] for body in rebuilt['exactModel']['bodies']] == [body_id]
    assert rebuilt['exactModel']['bodies'][0]['brep'] != initial['exactModel']['bodies'][0]['brep']

    page.get_by_role('button', name='Сборка', exact=True).click()
    for marker in markers:
        expect(marker).to_be_attached(timeout=120000)
        expect(marker).not_to_have_attribute('data-assembly-mesh-generation', previous_generation)
    current_generation = markers[0].get_attribute('data-assembly-mesh-generation')
    assert current_generation
    expect(markers[1]).to_have_attribute('data-assembly-mesh-generation', current_generation)
