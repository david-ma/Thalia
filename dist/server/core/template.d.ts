import { Thalia } from './types';
import { Views } from './types';
/**
 * Shows a webpage using Handlebars templates
 */
export declare function showWebpage(name: string, options?: {
    wrapper?: string;
    variables?: object;
}): (router: Thalia.Controller) => void;
/**
 * Sets Handlebars content
 */
export declare function setHandlebarsContent(content: string, Handlebars: any): Promise<void>;
/**
 * Loads views as Handlebars partials
 */
export declare function loadViewsAsPartials(views: Views, Handlebars: any): void;
