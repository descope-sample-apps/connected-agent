#!/bin/bash

# Create logos directory if it doesn't exist
mkdir -p public/logos

# Download existing logos
curl -o public/logos/crm-logo.png "https://cdn-icons-png.flaticon.com/512/2171/2171970.png"
curl -o public/logos/google-calendar.png "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/2048px-Google_Calendar_icon_%282020%29.svg.png"
curl -o public/logos/zoom-logo.png "https://download.logo.wine/logo/Zoom_Video_Communications/Zoom_Video_Communications-Logo.wine.png"
curl -o public/logos/google-docs.png "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Google_Docs_logo_%282014-2020%29.svg/1481px-Google_Docs_logo_%282014-2020%29.svg.png"
curl -o public/logos/servicenow-logo.png "https://upload.wikimedia.org/wikipedia/commons/5/57/ServiceNow_logo.svg"

# Download new icons
curl -o public/logos/user-icon.png "https://cdn-icons-png.flaticon.com/512/1077/1077114.png"
curl -o public/logos/assistant-icon.png "https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
curl -o public/logos/api-icon.png "https://cdn-icons-png.flaticon.com/512/1493/1493169.png"
curl -o public/logos/auth-icon.png "https://cdn-icons-png.flaticon.com/512/2889/2889676.png"
curl -o public/logos/data-icon.png "https://cdn-icons-png.flaticon.com/512/1548/1548784.png"
curl -o public/logos/create-icon.png "https://cdn-icons-png.flaticon.com/512/1160/1160758.png"
curl -o public/logos/step-icon.png "https://cdn-icons-png.flaticon.com/512/4947/4947506.png"

# Download Descope and OAuth logos
curl -o public/logos/descope-logo.png "https://descope.com/favicon.ico"
curl -o public/logos/oauth-logo.png "https://oauth.net/images/oauth-logo-square.png"

# Make the script executable
chmod +x scripts/download-logos.sh 