#!/usr/bin/env python
# -*- coding: utf-8 -*- #

from __future__ import unicode_literals

SITENAME = u'James J Porter'
AUTHOR = u'James Porter'
SITESUBTITLE = '\"Turns out I am a simple man, at best.\"'
SITEURL = 'http://jamesjporter.me'

PATH = 'content'  # OH MY GOD WHY

ARTICLE_URL = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'
ARTICLE_SAVE_AS = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'

PROFILE_IMAGE_URL = 'https://secure.gravatar.com/avatar/31c16c481409b0922890da5266fabdeb.png?s=300'

TYPOGRIFY = True

THEME = '/Users/james/projects/crowsfoot'

ARTICLE_PATHS = ['blog']

MENUITEMS = [('blog', '/'), ('cv', '/misc/cv.pdf')]

STATIC_PATHS = ['misc', 'img', 'julia', 'CNAME']

TIMEZONE = 'America/Chicago'

DEFAULT_LANG = u'en'

DEFAULT_PAGINATION = None

EXTRA_PATH_METADATA = {'extra/CNAME': {'path': 'CNAME'}}

RELATIVE_URLS = True

# addresses

EMAIL_ADDRESS = 'porterjamesj@gmail.com'
GITHUB_ADDRESS = 'http://github.com/porterjamesj'
SO_ADDRESS = 'http://stackoverflow.com/users/1663558/james-porter'
TWITTER_ADDRESS = 'http://twitter.com/porterjamesj'

# feed
FEED_RSS = 'feeds/rss.xml'
FEED_MAX_ITEMS = 10

SHOW_ARTICLE_AUTHOR = False

LICENSE_NAME = "CC BY-SA"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/"
