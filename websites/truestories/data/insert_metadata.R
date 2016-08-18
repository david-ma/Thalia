library(RMySQL)
library(RCurl)
library(stringr)

localphotostories <- read.csv("localphotostories20092014.csv", header=TRUE)
con <- dbConnect(MySQL(),
    user = 'root',
    password = 'colesfueloffer',
    host = 'localhost',
    dbname='govhack2015')
# dbWriteTable(conn = con, name = 'localphotostories', value = localphotostories)
# Iterate through the non-blank images
all_metadata_df <- NULL
for (i in 4495:dim(localphotostories)[1]) {
	# Get the XML
	xml_url <- as.character(localphotostories$"MediaRSS.URL"[i])
	cat("Processing", xml_url, "...")
	xml <- getURL(xml_url, .opts=curlOptions(followlocation=TRUE))
	pattern <- '<media:player url="(.*)"/>'
	media_player_tag <- str_extract(xml, pattern)
	if (is.na(media_player_tag))
		next
	article_url <- str_extract(media_player_tag, "\"(.*)\"")
	if (is.na(article_url))
		next
	article_url <- str_replace_all(article_url, "\"", "")
	# Get the article
	article <- getURL(article_url, .opts=curlOptions(followlocation=TRUE))
	# Extract the metadata
	metadata_tags <- str_extract_all(article, "<meta [^>]*?>")[[1]]
	n <- length(metadata_tags)
	# Metadata - schema optional, content
	metadata_df <- data.frame(Primary.image=rep(NA, n), name=rep(NA, n), content=rep(NA, n))
	for (j in 1:length(metadata_tags)) {
		# cat(metadata_tags[j], "\n")
		# Insert the metadata for Primary.image
		match1 <- str_match(metadata_tags[j], "<meta name=\"([^\"]*?)\" content=\"([^\"]*?)\" *?/>")
		match2 <- str_match(metadata_tags[j], "<meta property=\"([^\"]*?)\" content=\"([^\"]*?)\" *?/>")
		if (is.na(match1) && is.na(match2))
			next
		if (is.na(match1)) {
			match <- match2
		} else {
			match <- match1
		}
		# cat(as.character(localphotostories$"Primary.image")[i], match, "\n")
		metadata_df$"Primary.image"[j] <- as.character(localphotostories$"Primary.image")[i]
		metadata_df$name[j] <- match[1, 2]
		metadata_df$content[j] <- match[1, 3]		
	}
	cat(" ", dim(metadata_df)[1], "pieces of metadata extracted\n")
	if (is.null(all_metadata_df)) {
		all_metadata_df <- metadata_df
	}
	else {
		all_metadata_df <- rbind(all_metadata_df, metadata_df)
	}
}

write.csv(all_metadata_df, file="localphotostories_metadata.csv")
# Insert into the database
# dbWriteTable(conn = con, name = 'metadata', value = all_metadata_df)
