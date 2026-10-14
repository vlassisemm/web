import "@web_dialog_size/js/web_dialog_size.esm";
import {Component, xml} from "@odoo/owl";
import {animationFrame, beforeEach, expect, test} from "@odoo/hoot";
import {
    assignDialogTestEnv,
    contains,
    defineModels,
    fields,
    models,
    mountWithCleanup,
    onRpc,
    webModels,
} from "@web/../tests/web_test_helpers";
import {Dialog} from "@web/core/dialog/dialog";
import {browser} from "@web/core/browser/browser";

import {ActionDialog} from "@web/webclient/actions/action_dialog";

import {FormViewDialog} from "@web/views/view_dialogs/form_view_dialog";
import {SelectCreateDialog} from "@web/views/view_dialogs/select_create_dialog";

class IrConfigParameter extends models.Model {
    _name = "ir.config_parameter";
}
class Partner extends models.Model {
    name = fields.Char();
    _records = [{id: 1, name: "Dialog partner"}];
    _views = {
        list: '<list><field name="name"/></list>',
        search: "<search/>",
        form: '<form dialog_size="xl"><field name="name"/></form>',
    };
}
defineModels([
    IrConfigParameter,
    Partner,
    webModels.ResUsers,
    webModels.ResPartner,
    webModels.ResCompany,
]);
let defaultMaximize = false;
let delayedConfig = null;
beforeEach(() => {
    defaultMaximize = false;
    delayedConfig = null;
    browser.localStorage.removeItem("odoo.web_dialog_size.value");
    browser.localStorage.removeItem("odoo.web_dialog_size.last_server_value");
    onRpc(
        "ir.config_parameter",
        "get_web_dialog_size_config",
        () =>
            delayedConfig || {
                default_maximize: defaultMaximize,
            }
    );
});

async function openDialog(size = "lg", fullscreen = false) {
    class Parent extends Component {
        static components = {Dialog};
        static template = xml`<Dialog size="this.size" fullscreen="this.fullscreen">Content</Dialog>`;
        size = size;
        fullscreen = fullscreen;
    }
    assignDialogTestEnv();
    await mountWithCleanup(Parent);
    await animationFrame();
}

for (const size of ["sm", "md", "lg", "xl"]) {
    test(`maximize and restore standard size ${size}`, async () => {
        await openDialog(size);
        expect(`.modal-dialog.modal-${size}`).toHaveCount(1);
        await contains(
            'button[data-icon="expand_content"]:not(.o_expand_button)'
        ).click();
        expect(".modal-dialog.modal-fs").toHaveCount(1);
        expect(browser.localStorage.getItem("odoo.web_dialog_size.value")).toBe("true");
        await contains('button[data-icon="close_fullscreen"]').click();
        expect(`.modal-dialog.modal-${size}`).toHaveCount(1);
        expect(browser.localStorage.getItem("odoo.web_dialog_size.value")).toBe(
            "false"
        );
    });
}

test("server default maximizes first dialog", async () => {
    defaultMaximize = true;
    await openDialog("xl");
    expect(".modal-dialog.modal-fs").toHaveCount(1);
    await contains('button[data-icon="close_fullscreen"]').click();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
});

test("explicit local choice survives reopening", async () => {
    defaultMaximize = true;
    browser.localStorage.setItem("odoo.web_dialog_size.value", "false");
    browser.localStorage.setItem("odoo.web_dialog_size.last_server_value", "true");
    await openDialog();
    expect(".modal-dialog.modal-lg").toHaveCount(1);
});

test("changed server default updates a matching previous choice", async () => {
    browser.localStorage.setItem("odoo.web_dialog_size.value", "true");
    browser.localStorage.setItem("odoo.web_dialog_size.last_server_value", "true");
    await openDialog("md");
    expect(".modal-dialog.modal-md").toHaveCount(1);
});

test("fullscreen dialogs keep native navigation", async () => {
    await openDialog("lg", true);
    expect('button[data-icon="arrow_back"]').toHaveCount(1);
    expect('button[data-icon="expand_content"]:not(.o_expand_button)').toHaveCount(0);
});

test("selection dialog custom header maximizes and restores", async () => {
    assignDialogTestEnv();
    await mountWithCleanup(SelectCreateDialog, {
        props: {resModel: "partner", noCreate: true},
    });
    await animationFrame();
    await contains('button[data-icon="expand_content"]:not(.o_expand_button)').click();
    expect(".modal-dialog.modal-fs").toHaveCount(1);
    await contains('button[data-icon="close_fullscreen"]').click();
    expect(".modal-dialog.modal-lg").toHaveCount(1);
});

test("form arch dialog size survives maximize and restore", async () => {
    assignDialogTestEnv();
    await mountWithCleanup(FormViewDialog, {
        props: {resModel: "partner", resId: 1, close: () => expect.step("close")},
    });
    await animationFrame();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
    await contains('button[data-icon="expand_content"]:not(.o_expand_button)').click();
    expect(".modal-dialog.modal-fs").toHaveCount(1);
    await contains('button[data-icon="close_fullscreen"]').click();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
});

test("late false server default preserves native form arch size", async () => {
    let resolveConfig = null;
    delayedConfig = new Promise((resolve) => {
        resolveConfig = resolve;
    });
    assignDialogTestEnv();
    await mountWithCleanup(FormViewDialog, {
        props: {resModel: "partner", resId: 1, close: () => expect.step("close")},
    });
    await animationFrame();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
    resolveConfig({default_maximize: false});
    await animationFrame();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
});

test("late default response preserves a new manual choice", async () => {
    let resolveConfig = null;
    delayedConfig = new Promise((resolve) => {
        resolveConfig = resolve;
    });
    await openDialog("md");
    await contains('button[data-icon="expand_content"]:not(.o_expand_button)').click();
    resolveConfig({default_maximize: false});
    await animationFrame();
    expect(".modal-dialog.modal-fs").toHaveCount(1);
    expect(browser.localStorage.getItem("odoo.web_dialog_size.value")).toBe("true");
});

for (const fullscreen of [false, true]) {
    test(`action wizard header fullscreen ${fullscreen}`, async () => {
        class Wizard extends Component {
            static template = xml`<p class="wizard-content">Wizard content</p>`;
        }
        assignDialogTestEnv();
        await mountWithCleanup(ActionDialog, {
            props: {ActionComponent: Wizard, title: "Wizard", fullscreen},
        });
        expect(".wizard-content").toHaveText("Wizard content");
        if (fullscreen) {
            expect('button[data-icon="arrow_back"]').toHaveCount(1);
            expect(
                'button[data-icon="expand_content"]:not(.o_expand_button)'
            ).toHaveCount(0);
        } else {
            await contains(
                'button[data-icon="expand_content"]:not(.o_expand_button)'
            ).click();
            expect(".modal-dialog.modal-fs").toHaveCount(1);
            await contains('button[data-icon="close_fullscreen"]').click();
            expect(".modal-dialog.modal-lg").toHaveCount(1);
        }
    });
}
