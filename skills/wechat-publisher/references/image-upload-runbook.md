# Proven WeChat cover upload: image bytes bridge (2026-11-06)

## Why generic prompts fail
A local image path, generated-image identifier, and Google Drive URL are not automatically valid `image_url` values for the hosted WeChat MCP. The hosted connector accepts raw Base64 for images <=128 KiB, but the tool runner cannot directly read local files. Use the Files Library as a **temporary bridge**, then remove the temporary text file. Do not expose raw Base64 in chat.

## Exact validated path
1. Locate the *actual approved* cover in the current conversation or Library. If in Library, call `files__list` to get its real `file_id`, then `files__materialize` to copy raw bytes to the container.
2. Inspect with Pillow: target cover 900×383, RGB, baseline JPEG, <=128 KiB. If necessary, resize and save with `progressive=False`, optimizing quality until small enough. Never replace the user's approved image with unrelated stock art.
3. In the container, encode bytes to a UTF-8 ASCII text file: `base64.b64encode(open(image_path,'rb').read()).decode()`. Do not print the Base64.
4. Call `files__manage_library` upload to a uniquely named temporary `/*.txt` path.
5. **CRITICAL:** call `files__list` for the Library path and retrieve the resulting `turnNfileM` citation reference. `files__read` using a raw `file_...` ID may return a *not visible* warning and a short error message instead of content. Use `files__read({read:[{ref_id:'turnNfileM',mode:'full'}]})` and collect string content; check Base64 length roughly `4*ceil(bytes/3)`.
6. Call `wechat_upload_image({filename:'...jpg',purpose:'cover',image_base64:base64String})`. Validate that returned `media_id` is nonempty.
7. Create a draft using that `thumb_media_id`, or fetch the existing draft and `content_hash`, update it without changing the title/body, then **read back** to verify.
8. Delete the temporary Base64 text file from Library with `files__manage_library` and its returned `library_file_id`. Do not delete the original image.

## Verified run
- 2026-11-06: `ai_wall_street_cover.jpg`, 900×383 RGB JPEG, 78,342 bytes, materialized from Library, Base64 via temporary text file, uploaded successfully, WeChat cover media_id received, and the article `AI还在狂奔，华尔街却突然害怕了` created in draft box with readback verification.
- Another successful case: `gpt6_cyber_wechat_cover.jpg`, 900×383 JPEG, 72,606 bytes, same bridge and verified draft update.
- Important failure: attempting `files__read` using the new raw `file_...` ID returned only a visibility warning; passing that error text as Base64 caused an invalid Base64 error. **Always obtain and use the Library citation reference first.**

## Boundaries
This is a proven workflow, not an automatically installed software extension. Different ChatGPT conversations must explicitly load this runbook unless a compatible Skill integration is installed. No automatic cross-chat tool execution is guaranteed. Mobile load speed must be verified on the phone separately.
