/* Copyright 2023 Taras Shabaranskyi
 * License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl). */

import "@web_responsive/components/apps_menu/apps_menu.esm";
import {advanceTime, animationFrame, beforeEach, expect, press, test} from "@odoo/hoot";
import {
    contains,
    defineMenus,
    getService,
    mountWithCleanup,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import {NavBar} from "@web/webclient/navbar/navbar";
import {defineMailModels} from "@mail/../tests/mail_test_helpers";
import {session} from "@web/session";

// Load the patches (NavBar components) shipped by web_responsive

// The web_responsive module depends on mail (its systray/chatter patches), so the mail
// server models must be mocked for the NavBar to mount
defineMailModels();

beforeEach(() => {
    patchWithCleanup(session, {
        apps_menu: {search_type: "canonical", theme: "milk"},
    });
    defineMenus([
        {id: 1, name: "App0", appID: 1, xmlid: "menu_1", actionID: 1},
        {id: 2, name: "App1", appID: 2, xmlid: "menu_2", actionID: 2},
    ]);
});

test("can be rendered", async () => {
    await mountWithCleanup(NavBar);
    expect(".o_grid_apps_menu button.o_grid_apps_menu__button").toHaveCount(1, {
        message: "1 apps menu button present",
    });
});

test("can be opened and closed", async () => {
    await mountWithCleanup(NavBar);
    await contains("button.o_grid_apps_menu__button").click();
    expect(".o-app-menu-list").toHaveCount(1);
    await contains("button.o_grid_apps_menu__button").click();
    expect(".o-app-menu-list").toHaveCount(0);
});

test("can be active", async () => {
    await mountWithCleanup(NavBar);
    await contains("button.o_grid_apps_menu__button").click();
    getService("menu").setCurrentMenu(1);
    await animationFrame();
    expect('.o-app-menu-item.active[data-menu-xmlid="menu_1"]').toHaveCount(1);
    getService("menu").setCurrentMenu(2);
    await animationFrame();
    expect('.o-app-menu-item.active[data-menu-xmlid="menu_2"]').toHaveCount(1);
});

test("has a search input", async () => {
    await mountWithCleanup(NavBar);
    await contains("button.o_grid_apps_menu__button").click();
    expect(".app-menu-container .search-input").toHaveCount(1);
});

for (const searchType of ["canonical", "fuse"]) {
    test(`search menus using ${searchType}`, async () => {
        session.apps_menu.search_type = searchType;
        await mountWithCleanup(NavBar);
        await contains("button.o_grid_apps_menu__button").click();
        await contains(".search-input input").edit("App1");
        await advanceTime(250);
        expect(".search-item__name:first").toHaveText("App1");
    });
}

test("escape closes apps menu", async () => {
    await mountWithCleanup(NavBar);
    await contains("button.o_grid_apps_menu__button").click();
    await press("Escape");
    await animationFrame();
    expect(".app-menu-container").toHaveCount(0);
});
