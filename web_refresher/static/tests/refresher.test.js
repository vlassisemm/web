import "@web_refresher/js/control_panel.esm";
import {Component, onMounted, useProps, xml} from "@odoo/owl";
import {advanceTime, expect, test} from "@odoo/hoot";
import {
    contains,
    defineModels,
    getService,
    models,
    mountWithCleanup,
    mountWithSearch,
} from "@web/../tests/web_test_helpers";
import {registry} from "@web/core/registry";
import {WebClient} from "@web/webclient/webclient";

import {ControlPanel} from "@web/search/control_panel/control_panel";
import {Refresher} from "@web_refresher/js/refresher.esm";

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
    await mountRefresher({
        searchModel: {search: () => expect.step("search")},
        pagerProps: {
            offset: 20,
            limit: 10,
            onUpdate: (values) => {
                expect(values).toEqual({offset: 20, limit: 10});
                expect.step("pager");
            },
        },
    });
    await contains(".oe_pager_refresh").click();
    await advanceTime(250);
    expect.verifySteps(["pager"]);
});

test("invalid pager falls back to search", async () => {
    await mountRefresher({
        searchModel: {search: () => expect.step("search")},
        pagerProps: {},
    });
    await contains(".oe_pager_refresh").click();
    await advanceTime(250);
    expect.verifySteps(["search"]);
});

test("control panel mounts refresher for normal views", async () => {
    await mountWithSearch(ControlPanel, {resModel: "foo"});
    expect(".oe_pager_refresh").toHaveCount(1);
});

test("settings control panel omits refresher", async () => {
    await mountWithSearch(
        ControlPanel,
        {resModel: "foo"},
        {viewSubType: "base_settings"}
    );
    expect(".oe_pager_refresh").toHaveCount(0);
});

test("repeated client action refresh preserves actual history", async () => {
    class ClientAction extends Component {
        static components = {ControlPanel};
        static template = xml`<div><ControlPanel/><span class="client-label" t-out="this.props.action.name"/></div>`;
        props = useProps();
        setup() {
            onMounted(() => this.env.config.setDisplayName(this.props.action.name));
        }
    }
    registry.category("actions").add("refresher_test_action", ClientAction);
    await mountWithCleanup(WebClient);
    const action = getService("action");
    await action.doAction({
        type: "ir.actions.client",
        tag: "refresher_test_action",
        name: "First",
    });
    await contains(".oe_pager_refresh").click();
    await advanceTime(250);
    expect(".client-label").toHaveText("First");
    expect(".o_breadcrumb .breadcrumb-item, .o_breadcrumb .active").toHaveCount(1);
    await action.doAction({
        type: "ir.actions.client",
        tag: "refresher_test_action",
        name: "Second",
    });
    expect(".o_breadcrumb .breadcrumb-item, .o_breadcrumb .active").toHaveCount(2);
    for (let index = 0; index < 2; index++) {
        await contains(".oe_pager_refresh").click();
        await advanceTime(250);
        expect(".client-label").toHaveText("Second");
        expect(".o_breadcrumb .breadcrumb-item, .o_breadcrumb .active").toHaveCount(2);
    }
    await contains(".o_breadcrumb .breadcrumb-item:first").click();
    expect(".client-label").toHaveText("First");
});
