import { Thalia } from './types'
import { Views } from './types'
import { loadMustacheTemplate } from './requestHandlers'

/**
 * Shows a webpage using Handlebars templates
 */
export function showWebpage(
  name: string,
  options?: {
    wrapper?: string
    variables?: object
  }
) {
  options = options || {}
  return function (router: Thalia.Controller) {
    router.readAllViews((views) => {
      const wrapper = options.wrapper || name
      const template = router.handlebars.compile(views[wrapper])
      loadViewsAsPartials(views, router.handlebars)
      setHandlebarsContent(views[name], router.handlebars).then(() => {
        try {
          const html = template(options.variables || {})
          router.res.end(html)
        } catch (error) {
          console.log('Error loading content', error)
          router.response.writeHead(500, { 'Content-Type': 'text/plain' })
          router.response.end('Error loading webpage: ' + error.message)
        }
      })
    })
  }
}

/**
 * Sets Handlebars content
 */
export async function setHandlebarsContent(content: string, Handlebars: any): Promise<void> {
  return new Promise((resolve) => {
    Handlebars.registerPartial('content', content)
    resolve()
  })
}

/**
 * Loads views as Handlebars partials
 */
export function loadViewsAsPartials(views: Views, Handlebars: any): void {
  Object.entries(views).forEach(([name, content]) => {
    if (name.startsWith('_')) {
      Handlebars.registerPartial(name.slice(1), content)
    }
  })
} 