import {beforeEach, expect, test} from "@odoo/hoot";
import {
    click,
    contains,
    defineMailModels,
    openFormView,
    start,
    startServer,
} from "@mail/../tests/mail_test_helpers";
import {patchWithCleanup} from "@web/../tests/web_test_helpers";
import {session} from "@web/session";

defineMailModels();
beforeEach(() =>
    patchWithCleanup(session, {apps_menu: {search_type: "canonical", theme: "milk"}})
);

test("chatter renders and switches message and note composers", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({name: "Chatter partner"});
    await start();
    await openFormView("res.partner", partnerId);
    await contains(".o-mail-Chatter-topbar");
    await click(".o-mail-Chatter-logNote");
    await contains(".o-mail-Chatter-logNote.btn-primary.active");
    expect(".o-mail-Chatter-logNote").toHaveClass("btn-primary");
    expect(".o-mail-Chatter-sendMessage").toHaveClass("btn-secondary");
    await click(".o-mail-Chatter-sendMessage");
    await contains(".o-mail-Chatter-sendMessage.btn-primary.active");
    expect(".o-mail-Chatter-sendMessage").toHaveClass("btn-primary");
    expect(".o-mail-Chatter-logNote").toHaveClass("btn-secondary");
});
