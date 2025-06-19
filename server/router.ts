/**
 * Router - Request routing implementation
 *
 */

import { Website } from './website.js'

export class Router {
  private domains: { [key: string]: Website }
  private default: Website

  constructor(websites: Website[]) {
    // assert that websites is not empty
    if (websites.length === 0) {
      throw new Error('No websites provided')
    }
    this.default = websites[0]!

    // Create a map of websites
    this.domains = websites.reduce(
      (acc, website) => {
        if (website.name == 'default') {
          this.default = website
        }

        // Add all domains to the map
        const domains = website.config.domains ?? []
        domains.forEach((domain: string) => {
          acc[domain] = website
        })

        return acc
      },
      {} as { [key: string]: Website },
    )
  }

  public getWebsite(domain: string): Website {
    return this.domains[domain] || this.default
  }
}
