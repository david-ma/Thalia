# insert_local_photo_stories.R
library(RMySQL)

localphotostories <- read.csv("localphotostories20092014.csv", header=TRUE)
con <- dbConnect(MySQL(),
    user = 'root',
    password = 'secret',
    host = 'localhost',
    dbname='govhack2015')
dbWriteTable(conn = con, name = 'localphotostories', value = localphotostories)
