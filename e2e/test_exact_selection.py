"""Revision-bound exact selection through real WebGL picking and native rebuilds.

No synthetic selection events: each face is acquired with a physical canvas click.
"""
import copy
import re

from playwright.sync_api import expect
from test_regression import browser, page
from test_documents import tabs, import_json
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows
from test_sketch import create_sketch, extrude, edit_width


def blank_model(page):
    prepare(page)
    page.get_by_title('Новый документ', exact=True).click()
    expect(page.locator('[role="treeitem"]')).to_have_count(0)
    expect(exact_rows(page)).to_have_count(0)


def rendered(page, body_id):
    result = page.locator(f'[data-kernel-render-body="{body_id}"]')
    expect(result.first).to_have_attribute('data-exact-body-state', 'ready', timeout=120000)
    return result


def assert_volume(page, body_id, volume):
    rendered(page, body_id)
    page.wait_for_function(
        """({id, volume}) => {
          const nodes = [...document.querySelectorAll('[data-kernel-render-body]')]
            .filter(node => node.dataset.kernelRenderBody === id);
          return nodes.length > 0 && nodes.every(node => {
            const actual = Number(node.dataset.exactBodyVolume);
            return Number.isFinite(actual) && Math.abs(actual - volume) < 1e-7 * Math.max(1, volume);
          });
        }""", arg={'id': body_id, 'volume': volume}, timeout=120000,
    )


def no_face_highlight(page, body_id):
    rendered(page, body_id)
    page.wait_for_function(
        """id => {
          const nodes = [...document.querySelectorAll('[data-kernel-render-body]')]
            .filter(node => node.dataset.kernelRenderBody === id);
          return nodes.length > 0 && nodes.every(node => !node.hasAttribute('data-exact-selected-face'));
        }""", arg=body_id,
    )


def pick_face(page, body_id, viewport=0):
    view = page.locator('.view-wrap').nth(viewport)
    metadata = view.locator(f'[data-kernel-render-body="{body_id}"]')
    expect(metadata).to_have_attribute('data-exact-body-state', 'ready', timeout=120000)
    canvas = view.locator('.viewport canvas').first
    expect(canvas).to_be_visible()
    # Bounds.fit animates the camera after an asynchronous mesh arrives. Poll
    # actual ray hits at the middle of the only convex body in an empty model.
    for _ in range(8):
        box = canvas.bounding_box()
        assert box and box['width'] > 0 and box['height'] > 0
        page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        try:
            expect(metadata).to_have_attribute('data-exact-selected-face', re.compile(r'^-?\d+$'), timeout=1000)
            return metadata.get_attribute('data-exact-selected-face')
        except AssertionError:
            pass
    expect(metadata).to_have_attribute('data-exact-selected-face', re.compile(r'^-?\d+$'))
    return metadata.get_attribute('data-exact-selected-face')


def test_real_face_pick_same_body_rebuild_and_history_drop_revision_local_face(page, tmp_path):
    blank_model(page)
    sketch_id = create_sketch(page, width=2, height=3)
    extrude(page, depth=4)
    before = save_document(page, tmp_path, 'selection-before.json')
    body = before['exactModel']['bodies'][0]
    body_id = body['id']
    # The transaction must select its newly created result, not just store a
    # pending ID which never becomes actionable after React commits the model.
    expect(page.locator(f'[data-exact-body-row="{body_id}"]').get_by_role('button')).to_have_attribute('aria-pressed', 'true')
    assert_volume(page, body_id, 24)
    original_revision = int(rendered(page, body_id).first.get_attribute('data-exact-body-revision'))
    assert pick_face(page, body_id) is not None

    edit_width(page, sketch_id, 5)
    assert_volume(page, body_id, 60)
    after = save_document(page, tmp_path, 'selection-after.json')
    rebuilt = after['exactModel']['bodies'][0]
    assert rebuilt['id'] == body_id
    assert rebuilt['brep'] != body['brep'], 'the same source-owned body must really rebuild'
    rebuilt_revision = int(rendered(page, body_id).first.get_attribute('data-exact-body-revision'))
    assert rebuilt_revision > original_revision
    no_face_highlight(page, body_id)
    expect(page.locator(f'[data-exact-body-row="{body_id}"]').get_by_role('button')).to_have_attribute('aria-pressed', 'true')

    # Acquire a new real face, then traverse both directions of actual geometry
    # history. Neither an old cached mesh nor a reused face hash may restore it.
    assert pick_face(page, body_id) is not None
    page.keyboard.press('Control+z')
    assert_volume(page, body_id, 24)
    undo_revision = int(rendered(page, body_id).first.get_attribute('data-exact-body-revision'))
    assert undo_revision > rebuilt_revision, 'A→B→A must advance identity, never revive A references'
    no_face_highlight(page, body_id)
    page.keyboard.press('Control+y')
    assert_volume(page, body_id, 60)
    assert int(rendered(page, body_id).first.get_attribute('data-exact-body-revision')) > undo_revision
    no_face_highlight(page, body_id)


def test_same_body_ids_and_brep_do_not_transfer_face_selection_between_document_tabs(page, tmp_path):
    blank_model(page)
    create_box(page, size=(2, 3, 4))
    original = save_document(page, tmp_path, 'selection-source.json')
    body_id = original['exactModel']['bodies'][0]['id']
    assert pick_face(page, body_id) is not None
    # Reuse a real cached payload in a second viewport: it must not cancel the
    # first viewport's selection while joining the same document's renderer.
    page.locator('.multi-view-tools').get_by_role('button', name='2', exact=True).click()
    expect(rendered(page, body_id)).to_have_count(2, timeout=120000)
    page.wait_for_function(
        """id => [...document.querySelectorAll('[data-kernel-render-body]')]
          .filter(node => node.dataset.kernelRenderBody === id)
          .every(node => node.hasAttribute('data-exact-selected-face'))""", arg=body_id,
    )
    duplicate = copy.deepcopy(original)
    duplicate['id'] = original['id'] + '-selection-copy'
    duplicate['name'] = 'Копия для проверки изоляции'
    import_json(page, duplicate, 'selection-copy.json')
    expect(tabs(page).get_by_role('tab')).to_have_count(3)
    # Deliberately identical body IDs and BREP make document identity the only
    # reliable scope; no "different IDs" shortcut can satisfy this assertion.
    expect(page.locator(f'[data-exact-body-row="{body_id}"]')).to_have_count(1)
    no_face_highlight(page, body_id)
    assert pick_face(page, body_id) is not None
    tabs(page).get_by_role('tab').nth(1).click()
    no_face_highlight(page, body_id)
    assert pick_face(page, body_id) is not None
    tabs(page).get_by_role('tab').nth(2).click()
    no_face_highlight(page, body_id)


def test_canonical_face_survives_client_cache_eviction_and_four_viewports(page):
    blank_model(page)
    create_box(page, size=(2, 3, 4))
    body_id = exact_rows(page).first.get_attribute('data-exact-body-row')
    # Native distinct BREP results exceed KernelClient's eight-entry cache.
    # Hidden fillers are retained sources, but only the first box remains a
    # visible ray target. No synthetic meshes or private selection APIs.
    for i in range(9):
        create_box(page, size=(1 + i / 10, 1, 1), origin=(20 + 3 * i, 0, 0))
        row = exact_rows(page).last
        row.get_by_role('checkbox').uncheck()
    expect(exact_rows(page)).to_have_count(10)
    page.locator('.view-wrap').first.get_by_title('Вписать модель', exact=True).click()
    assert pick_face(page, body_id) is not None
    canonical_generation = rendered(page, body_id).first.get_attribute('data-exact-mesh-generation')
    page.locator('.multi-view-tools').get_by_role('button', name='4', exact=True).click()
    expect(rendered(page, body_id)).to_have_count(4, timeout=120000)
    page.wait_for_function(
        """({id, generation}) => {
          const nodes = [...document.querySelectorAll('[data-kernel-render-body]')]
            .filter(node => node.dataset.kernelRenderBody === id);
          return nodes.length === 4 && nodes.every(node =>
            node.dataset.exactMeshGeneration === generation &&
            node.hasAttribute('data-exact-selected-face-group'));
        }""", arg={'id': body_id, 'generation': canonical_generation}, timeout=120000,
    )
    # A physical click in a newly mounted front viewport must keep the same
    # canonical group in every other window, rather than oscillating tokens.
    assert pick_face(page, body_id, viewport=0) is not None
    groups = rendered(page, body_id).evaluate_all('(nodes) => nodes.map(n => n.dataset.exactSelectedFaceGroup)')
    assert len(groups) == 4 and None not in groups and len(set(groups)) == 1


def test_failed_native_inspection_is_visible_and_retries_without_stale_payload(page, tmp_path):
    blank_model(page)
    create_box(page, size=(2, 3, 4))
    saved = save_document(page, tmp_path, 'inspection-retry.json')
    body_id = saved['exactModel']['bodies'][0]['id']
    assert pick_face(page, body_id) is not None
    # Reload a real persisted body while its actual WASM asset is unavailable.
    # No fabricated kernel reply or private selection mutation is involved.
    blocked = []
    wasm = re.compile(r'/assets/occt-wasm-[^/]+\.wasm(?:\?.*)?$')
    def abort_wasm(route):
        blocked.append(route.request.url)
        route.abort('failed')
    page.route(wasm, abort_wasm)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    retry = page.get_by_role('button', name='Повторить расчёт Параллелепипед', exact=True)
    expect(retry).to_be_visible(timeout=120000)
    assert blocked, 'a real WASM request must fail, not a form validation'
    expect(page.locator(f'[data-kernel-render-body="{body_id}"]')).to_have_count(0)
    page.unroute(wasm, abort_wasm)
    retry.click()
    assert_volume(page, body_id, 24)
    no_face_highlight(page, body_id)
    assert pick_face(page, body_id) is not None
