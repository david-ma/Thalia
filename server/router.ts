/**
 * Router - Request routing implementation
 * 
 */

import { Website } from './types'

export class Router {
  private websites: Website[]
  constructor(websites: Website[]) {
    // assert that websites is not empty
    if (websites.length === 0) {
      throw new Error('No websites provided')
    }
    this.websites = websites
  }

  public getWebsite(path: string): Website | null {
    console.log(path)
    return this.websites[0] || null
  }
}