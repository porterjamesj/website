#!/usr/bin/env python
# -*- coding: utf-8 -*- #

from __future__ import unicode_literals

SITENAME = u'James Porter'
AUTHOR = u'James Porter'
SITEURL = 'http://jamesporter.me'

PATH = 'content'  # OH MY GOD WHY

ARTICLE_URL = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'

TYPOGRIFY = True

THEME = 'theme'

ARTICLE_PATHS = ['blog']

MENUITEMS = [
    ('about', '/pages/about.html'),
    ('blog', '/'),
    ('cv', '/misc/cv.pdf'),
    ('github', 'http://github.com/porterjamesj'),
    ('twitter', 'http://twitter.com/porterjamesj'),
    ('email', 'james@jamesporter.me'),
]

STATIC_PATHS = ['misc', 'img', 'julia', 'extra/CNAME']
EXTRA_PATH_METADATA = {'extra/CNAME': {'path': 'CNAME'}}

TIMEZONE = 'America/New_York'

DEFAULT_LANG = u'en'

DEFAULT_PAGINATION = None

RELATIVE_URLS = True

# feed
FEED_RSS = 'feeds/rss.xml'
FEED_MAX_ITEMS = 10

LICENSE_NAME = "CC BY-SA"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/"
