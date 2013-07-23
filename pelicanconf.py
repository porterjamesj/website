#!/usr/bin/env python
# -*- coding: utf-8 -*- #

SITENAME = u'James J Porter'
AUTHOR = u'James Porter'
SITESUBTITLE = '\"TURNS OUT I AM A SIMPLE MAN, AT BEST.\"'
SITEURL = 'http://jamesjporter.me'

ARTICLE_URL = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'
ARTICLE_SAVE_AS = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'

PROFILE_IMAGE_URL = 'https://secure.gravatar.com/avatar/31c16c481409b0922890da5266fabdeb.png?s=300'

TYPOGRIFY = True

THEME = '/Users/james/projects/crowsfoot'

MENUITEMS = [('blog', '/'),('cv', '/static/misc/cv.pdf')]

STATIC_PATHS =['misc', 'img']

TIMEZONE = 'America/Chicago'

DEFAULT_LANG = u'en'

DEFAULT_PAGINATION = None

FILES_TO_COPY = (('extra/CNAME', 'CNAME'),)

# addresses

EMAIL_ADDRESS = 'porterjamesj@gmail.com'
GITHUB_ADDRESS = 'http://github.com/porterjamesj'
SO_ADDRESS = 'http://stackoverflow.com/users/1663558/james-porter'

# feed
FEED_RSS = 'feeds/rss.xml'
FEED_MAX_ITEMS = 10

SHOW_ARTICLE_AUTHOR = False

LICENSE_NAME = "CC BY-SA"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/"
