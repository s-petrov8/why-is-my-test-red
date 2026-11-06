import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { Routes } from '../../enums/app/app';

/**
 * The side panel's main menu, on every signed-in screen. Which items it holds
 * depends on the signed-in person's roles.
 */
export class MainMenuComponent {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get sidePanel(): Locator {
        return this.page.getByRole('navigation', { name: 'Sidepanel' });
    }

    get menuLinks(): Locator {
        return this.sidePanel.getByRole('list').getByRole('link');
    }

    menuLink(name: string): Locator {
        return this.menuLinks.filter({ hasText: name });
    }

    // ==================== Actions ====================

    /**
     * Navigates to the dashboard, the screen a sign-in lands on.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openDashboard(): Promise<void> {
        await this.page.goto(`${appConfig.appUrl}${Routes.DASHBOARD}`, {
            waitUntil: 'domcontentloaded',
        });
    }
}
