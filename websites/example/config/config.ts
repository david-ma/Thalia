
import { Thalia, users } from 'thalia'

export const config: Thalia.WebsiteConfig ={
  domains: ['www.yourwebsite.com'],
  controllers: {
    // '': function (router) {
    //   console.log("hi")
    //   router.res.end('Hello this is example!')
    // },

    ...users({})
  },
}
