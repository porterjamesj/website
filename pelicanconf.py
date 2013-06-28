#!/usr/bin/env python
# -*- coding: utf-8 -*- #

SITENAME = u'James J Porter'
AUTHOR = u'James Porter'
SITESUBTITLE = '\"Turns out I am a simple man, at best.\"'
SITEURL = 'http://jamesjporter.me'

ARTICLE_URL = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'
ARTICLE_SAVE_AS = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'

PROFILE_IMAGE_URL = 'https://secure.gravatar.com/avatar/31c16c481409b0922890da5266fabdeb.png?s=100'

TYPOGRIFY = True

THEME = 'mytheme'

MENUITEMS = [('blog','/'),('cv','/static/misc/cv.pdf')]

STATIC_PATHS =['misc']

TIMEZONE = 'America/Chicago'

DEFAULT_LANG = u'en'

DEFAULT_PAGINATION = None

FILES_TO_COPY = (('extra/CNAME','CNAME'),)

# addresses

EMAIL_ADDRESS = 'porterjamesj@gmail.com'
GITHUB_ADDRESS = 'http://github.com/porterjamesj'
SO_ADDRESS = 'http://stackoverflow.com/users/1663558/james-porter'

# feed
FEED_RSS = 'feeds/rss.xml'
FEED_MAX_ITEMS = 10
