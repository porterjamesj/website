#!/usr/bin/env python
# -*- coding: utf-8 -*- #

from __future__ import unicode_literals
from datetime import datetime

SITENAME = u'James Porter'
AUTHOR = u'James Porter'
SITEURL = 'http://jamesporter.me'

PATH = 'content'  # OH MY GOD WHY

ARTICLE_URL = '{date:%Y}/{date:%m}/{date:%d}/{slug}.html'
ARTICLE_SAVE_AS = ARTICLE_URL

TYPOGRIFY = True

THEME = 'theme'

ARTICLE_PATHS = ['blog']

MENUITEMS = [
    ('blog', '/'),
    ('about', '/pages/about.html'),
    ('cv', '/misc/cv.pdf'),
    ('github', 'http://github.com/porterjamesj'),
    ('twitter', 'http://twitter.com/porterjamesj'),
    ('email', 'mailto:james@jamesporter.me'),
]

STATIC_PATHS = ['misc', 'img', 'julia', 'extra/CNAME']
EXTRA_PATH_METADATA = {'extra/CNAME': {'path': 'CNAME'}}

TIMEZONE = 'America/New_York'

DEFAULT_LANG = u'en'
DEFAULT_DATE_FORMAT = "%d %b %Y"
DEFAULT_PAGINATION = None

RELATIVE_URLS = True

# feed
FEED_RSS = 'feeds/rss.xml'
FEED_MAX_ITEMS = 10

LICENSE_NAME = "CC BY-NC"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/"


# easy hack for getting the current time in jinja
NOW = datetime.now()
