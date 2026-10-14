import {beforeEach, describe, expect, test} from "@odoo/hoot";
import {
    contains,
    defineModels,
    defineWebModels,
    fields,
    getService,
    makeServerError,
    mockOffline,
    models,
    mountView,
    mountWithCleanup,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import {Many2XAutocomplete} from "@web/views/fields/relational_utils";
import {OfflinePlugin} from "@web/core/offline/offline_plugin";
import {queryAll} from "@odoo/hoot-dom";
import {runAllTimers} from "@odoo/hoot-mock";
import {session} from "@web/session";

describe.current.tags("desktop");

class Partner extends models.Model {
    name = fields.Char();
    type = fields.Selection({
        selection: [
            ["contact", "Contact"],
            ["delivery", "Delivery"],
        ],
    });
    parent_id = fields.Many2one({relation: "partner"});
    tag_ids = fields.Many2many({relation: "partner"});
    child_ids = fields.One2many({relation: "partner", relation_field: "parent_id"});
    _records = [
        {id: 1, name: "Acme", type: "contact"},
        {id: 2, name: "Acme Warehouse", type: "delivery"},
        {
            id: 3,
            name: "Jane",
            type: "contact",
            parent_id: 1,
            tag_ids: [],
            child_ids: [4, 5, 6],
        },
        {id: 4, name: "Child A", parent_id: 3},
        {id: 5, name: "Child B", parent_id: 3},
        {id: 6, name: "Child C", parent_id: 3},
    ];
}
defineModels([Partner]);
defineWebModels();
beforeEach(() => patchWithCleanup(session, {web_m2x_options: {}}));

async function mountField(options = "{}", attrs = "", name = "parent_id") {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 3,
        arch: `<form><field name="${name}" ${name === "tag_ids" ? 'widget="many2many_tags"' : ""} options="${options}" ${attrs}/></form>`,
    });
}
async function search(value = "New company") {
    await contains(".o_field_widget input").edit(value, {confirm: false});
    await runAllTimers();
}

test("global create, create_edit and open disable relational actions", async () => {
    Object.assign(session.web_m2x_options, {
        "web_m2x_options.create": "False",
        "web_m2x_options.create_edit": "False",
        "web_m2x_options.open": "False",
    });
    await mountField();
    expect(".o_external_button").toHaveCount(0);
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(0);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(0);
});

test("explicit field overrides restore actions over global defaults", async () => {
    Object.assign(session.web_m2x_options, {
        "web_m2x_options.create": "False",
        "web_m2x_options.create_edit": "False",
        "web_m2x_options.open": "False",
    });
    await mountField(
        "{'no_quick_create': False, 'no_create_edit': False, 'no_open': False}"
    );
    expect(".o_external_button").toHaveCount(1);
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(1);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(1);
});

test("legacy create overrides keep the merged 18.0 fix", async () => {
    Object.assign(session.web_m2x_options, {
        "web_m2x_options.create": "False",
        "web_m2x_options.create_edit": "False",
    });
    await mountField("{'create': True, 'create_edit': True}");
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(1);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(1);
});

test("no_create blocks both actions despite explicit overrides", async () => {
    await mountField("{'no_create': True, 'create': True, 'create_edit': True}");
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(0);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(0);
});

test("field overrides respect can_create permissions", async () => {
    await mountField(
        "{'no_quick_create': False, 'no_create_edit': False}",
        'can_create="False"'
    );
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(0);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(0);
});

test("quick create creates and selects the new record", async () => {
    await mountField();
    await search();
    await contains(".o_m2o_dropdown_option_create").click();
    expect(".o_field_many2one input").toHaveValue("New company");
});

test("create edit opens the related form", async () => {
    Partner._views = {form: '<form><field name="name"/></form>'};
    await mountField();
    await search();
    await contains(".o_m2o_dropdown_option_create_edit").click();
    expect(".modal .o_form_view").toHaveCount(1);
});

for (const [label, options, limit] of [
    ["global", "{}", 3],
    ["field", "{'limit': 2}", 2],
]) {
    test(`${label} search limit reaches the real relational search`, async () => {
        session.web_m2x_options["web_m2x_options.limit"] = "3";
        onRpc("web_name_search", ({kwargs}) => expect.step(`limit=${kwargs.limit}`));
        await mountField(options);
        await search("Acme");
        expect.verifySteps([`limit=${limit}`]);
    });
}

test("many2one dropdown keeps field colors through Owl props", async () => {
    await mountField(
        "{'field_color': 'type', 'colors': {'contact': 'green', 'delivery': 'blue'}}"
    );
    await search("Acme");
    const items = queryAll(
        ".o_field_many2one .o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option) .dropdown-item"
    );
    expect(items).toHaveLength(2);
    expect(items.map((el) => [el.textContent.trim(), el.style.color])).toEqual([
        ["Acme", "green"],
        ["Acme Warehouse", "blue"],
    ]);
});

test("many2many global create actions are disabled", async () => {
    Object.assign(session.web_m2x_options, {
        "web_m2x_options.create": "False",
        "web_m2x_options.create_edit": "False",
    });
    await mountField("{}", "", "tag_ids");
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(0);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(0);
});

test("many2many no_create cannot be reenabled by global defaults", async () => {
    await mountField("{'no_create': True}", "", "tag_ids");
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(0);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(0);
});

test("global subview limit limits one2many rows", async () => {
    session.web_m2x_options["web_m2x_options.field_limit_entries"] = "2";
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 3,
        arch: '<form><field name="child_ids"><list><field name="name"/></list></field></form>',
    });
    expect(".o_field_one2many .o_data_row").toHaveCount(2);
});

test("many2many field overrides restore both create actions", async () => {
    Object.assign(session.web_m2x_options, {
        "web_m2x_options.create": "False",
        "web_m2x_options.create_edit": "False",
    });
    await mountField(
        "{'no_quick_create': False, 'no_create_edit': False}",
        "",
        "tag_ids"
    );
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(1);
    expect(".o_m2o_dropdown_option_create_edit").toHaveCount(1);
});

test("many2many search limit and color options reach autocomplete", async () => {
    onRpc("web_name_search", ({kwargs}) => expect.step(`limit=${kwargs.limit}`));
    await mountField(
        "{'limit': 3, 'field_color': 'type', 'colors': {'contact': 'green', 'delivery': 'blue'}}",
        "",
        "tag_ids"
    );
    await search("Acme");
    expect.verifySteps(["limit=3"]);
    const items = queryAll(
        ".o_field_many2many_tags .o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option) .dropdown-item"
    );
    expect(items.map((el) => el.style.color)).toEqual(["green", "blue"]);
});

test("domain-valued create option stays with the core expression evaluator", async () => {
    await mountField("{'create': [('id', '!=', False)]}", "", "tag_ids");
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(1);
});

test("missing session options keep default relational behavior", async () => {
    patchWithCleanup(session, {web_m2x_options: undefined});
    await mountField();
    expect(".o_external_button").toHaveCount(1);
    await search();
    expect(".o_m2o_dropdown_option_create").toHaveCount(1);
});

test("global subview limit also applies to fetched subviews", async () => {
    session.web_m2x_options["web_m2x_options.field_limit_entries"] = "2";
    Partner._views = {list: '<list><field name="name"/></list>'};
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 3,
        arch: '<form><field name="child_ids" mode="list"/></form>',
    });
    expect(".o_field_one2many .o_data_row").toHaveCount(2);
});

for (const name of ["parent_id", "tag_ids"]) {
    test(`${name}: global create_edit disables creation in Search More`, async () => {
        Object.assign(session.web_m2x_options, {
            "web_m2x_options.create_edit": "False",
            "web_m2x_options.limit": "2",
        });
        Partner._views = {list: '<list><field name="name"/></list>'};
        await mountField("{}", "", name);
        await search("Acme");
        await contains(".o_m2o_dropdown_option_search_more").click();
        expect(".modal .o_list_view").toHaveCount(1);
        expect(".modal .o_create_button").toHaveCount(0);
    });
}

async function selectWarehouse(name) {
    await contains(
        ".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option) a:contains(Acme Warehouse)"
    ).click();
    if (name === "parent_id") {
        expect(".o_field_many2one input").toHaveValue("Acme Warehouse");
    } else {
        expect(".o_field_many2many_tags .badge").toHaveText("Acme Warehouse");
    }
}

for (const name of ["parent_id", "tag_ids"]) {
    test(`${name}: cached offline suggestions remain selectable with field colors`, async () => {
        const setOffline = mockOffline();
        await mountField(
            "{'field_color': 'type', 'colors': {'contact': 'green', 'delivery': 'blue'}}",
            "",
            name
        );
        await search("Acme");
        expect(
            ".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option)"
        ).toHaveCount(2);
        await contains(".o_form_view").click();
        const cached = await getService(OfflinePlugin).searchMany2XRecords(
            "partner",
            "Acme"
        );
        expect(cached.map((record) => record.display_name).sort()).toEqual([
            "Acme",
            "Acme Warehouse",
        ]);
        await setOffline(true);
        await search("Acme Ware");
        expect(
            ".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option)"
        ).toHaveCount(1);
        expect(".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option)").toHaveText(
            "Acme Warehouse"
        );
        await selectWarehouse(name);
    });

    test(`${name}: losing connection during color lookup preserves suggestions`, async () => {
        const setOffline = mockOffline();
        onRpc("partner", "search_read", async () => {
            expect(getService(OfflinePlugin).isOffline()).toBe(false);
            expect.step("color lookup disconnected");
            await setOffline(true);
            return new Response("", {status: 502});
        });
        await mountField(
            "{'field_color': 'type', 'colors': {'contact': 'green', 'delivery': 'blue'}}",
            "",
            name
        );
        await search("Acme");
        expect.verifySteps(["color lookup disconnected"]);
        await contains(
            ".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option) a:contains(Acme Warehouse)"
        ).hover();
        expect(
            ".o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option)"
        ).toHaveCount(2);
        await selectWarehouse(name);
    });
}

for (const [name, error] of [
    [
        "authorization",
        makeServerError({type: "AccessError", message: "Color lookup forbidden"}),
    ],
    ["unexpected", new Error("Unexpected color lookup failure")],
]) {
    test(`${name} color lookup errors still reject the suggestions`, async () => {
        const autocomplete = await mountWithCleanup(Many2XAutocomplete, {
            props: {
                activeActions: {create: true, createEdit: true},
                fieldString: "Partner",
                getDomain: () => [],
                resModel: "partner",
                update: () => undefined,
                fieldColor: "type",
                fieldColorOptions: {contact: "green", delivery: "blue"},
            },
        });
        patchWithCleanup(autocomplete.orm, {
            call(model, method) {
                if (method === "search_read") {
                    throw error;
                }
                return super.call(...arguments);
            },
        });
        await expect(autocomplete.loadOptionsSource("Acme")).rejects.toThrow(error);
    });
}
