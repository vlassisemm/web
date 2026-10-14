import {advanceTime, expect, test} from "@odoo/hoot";
import {Component, xml} from "@odoo/owl";
import {assignTestEnv, contains, defineModels, getService, models, mountWithCleanup, mountWithSearch, patchWithCleanup} from "@web/../tests/web_test_helpers";
import {ControlPanel} from "@web/search/control_panel/control_panel";
import {Refresher} from "@web_refresher/js/refresher.esm";
import "@web_refresher/js/control_panel.esm";

class Foo extends models.Model {}
defineModels([Foo]);

async function mountRefresher(props) {
    class Parent extends Component {
        static components = {Refresher};
        static template = xml`<div class="o_content"><Refresher t-props="this.refreshProps"/></div>`;
        refreshProps = props;
    }
    await mountWithCleanup(Parent);
}

test("search refresh is debounced and animated", async () => {
    await mountRefresher({searchModel: {search: () => expect.step("search")}});
    await contains(".oe_pager_refresh").click();
    await contains(".oe_pager_refresh").click();
    expect.verifySteps([]);
    await advanceTime(250);
    expect.verifySteps(["search"]);
    expect(".o_content").toHaveClass("o_content__refresh");
    await advanceTime(1000);
    expect(".o_content").not.toHaveClass("o_content__refresh");
});

test("pager reload preserves offset and limit before search fallback", async () => {
    await mountRefresher({searchModel: {search: () => expect.step("search")}, pagerProps: {offset: 20, limit: 10, onUpdate: (values) => {expect(values).toEqual({offset: 20, limit: 10}); expect.step("pager");}}});
    await contains(".oe_pager_refresh").click();
    await advanceTime(250);
    expect.verifySteps(["pager"]);
});

test("invalid pager falls back to search", async () => {
    await mountRefresher({searchModel: {search: () => expect.step("search")}, pagerProps: {}});
    await contains(".oe_pager_refresh").click();
    await advanceTime(250);
    expect.verifySteps(["search"]);
});

test("control panel mounts refresher for normal views", async () => {
    await mountWithSearch(ControlPanel, {resModel: "foo"});
    expect(".oe_pager_refresh").toHaveCount(1);
});

test("settings control panel omits refresher", async () => {
    await mountWithSearch(ControlPanel, {resModel: "foo"}, {viewSubType: "base_settings"});
    expect(".oe_pager_refresh").toHaveCount(0);
});

for (const hasHistory of [false, true]) {
    test(`client action refresh with history ${hasHistory}`, async () => {
        const action = {type: "ir.actions.client", tag: "test_client"};
        assignTestEnv({config: {breadcrumbs: hasHistory ? [{jsId: "previous"}, {jsId: "current"}] : []}});
        await mountRefresher({});
        patchWithCleanup(getService("action"), {
            get currentController() {return {action};},
            restore: async (jsId) => {expect(jsId).toBe("current"); expect.step("restore");},
            doAction: (value, options) => {expect(value).toBe(action); expect(options).toEqual(hasHistory ? {} : {clearBreadcrumbs: true}); expect.step("action");},
        });
        await contains(".oe_pager_refresh").click();
        await advanceTime(250);
        expect.verifySteps(hasHistory ? ["restore", "action"] : ["action"]);
    });
}
