#!/usr/bin/env python
# -*- coding: utf-8 -*- #

SITENAME = u'James J Porter'
SITESUBTITLE = '\"Turns out I am a simple man, at best.\"'
SITEURL = 'http://jamesjporter.me'

PROFILE_IMAGE_URL = 'https://secure.gravatar.com/avatar/31c16c481409b0922890da5266fabdeb.png?s=100'

TYPOGRIFY = True

THEME = 'mytheme'

MENUITEMS = [('blog','/'),('cv','/static/misc/cv.pdf')]

STATIC_PATHS =['misc']

TIMEZONE = 'America/Chicago'

DEFAULT_LANG = u'en'

DEFAULT_PAGINATION = False

FILES_TO_COPY = (('extra/CNAME','CNAME'),)
