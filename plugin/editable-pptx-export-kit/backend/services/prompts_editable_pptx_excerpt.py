# -*- coding: utf-8 -*-
# 摘录自 backend/services/prompts.py — 可编辑 PPTX 文字样式 VLM 用 prompt
# 原仓库 text_attribute_extractors 从 services.prompts 导入；迁出后可改 import 指向本文件。
        "element_id": "xxx",
        "text_content": "鏂囧瓧鍐呭",
        "font_color": "#RRGGBB",
        "is_bold": true/false,
        "is_italic": true/false,
        "is_underline": true/false,
        "text_alignment": "瀵归綈鏂瑰紡"
    }},
    ...
]
```
"""
    
    # logger.debug(f"[get_batch_text_attribute_extraction_prompt] Final prompt:\n{prompt}")
    return prompt


def get_quality_enhancement_prompt(inpainted_regions: list = None) -> str:
    """
    鐢熸垚鐢昏川鎻愬崌鐨?prompt
    鐢ㄤ簬鍦ㄧ櫨搴﹀浘鍍忎慨澶嶅悗锛屼娇鐢ㄧ敓鎴愬紡妯″瀷鎻愬崌鏁翠綋鐢昏川
    
    Args:
        inpainted_regions: 琚慨澶嶅尯鍩熷垪琛紝姣忎釜鍖哄煙鍖呭惈鐧惧垎姣斿潗鏍囷細
            - left, top, right, bottom: 鐩稿浜庡浘鐗囧楂樼殑鐧惧垎姣?(0-100)
            - width_percent, height_percent: 鍖哄煙瀹介珮鍗犲浘鐗囩殑鐧惧垎姣?    """
    import json
    
    # 鏋勫缓鍖哄煙淇℃伅
    regions_info = ""
    if inpainted_regions and len(inpainted_regions) > 0:
        regions_json = json.dumps(inpainted_regions, ensure_ascii=False, indent=2)
        regions_info = f"""
浠ヤ笅鏄鎶归櫎宸ュ叿澶勭悊杩囩殑鍏蜂綋鍖哄煙锛堝叡 {len(inpainted_regions)} 涓煩褰㈠尯鍩燂級锛岃閲嶇偣淇杩欎簺浣嶇疆锛?
```json
{regions_json}
```

鍧愭爣璇存槑锛堟墍鏈夋暟鍊奸兘鏄浉瀵逛簬鍥剧墖瀹介珮鐨勭櫨鍒嗘瘮锛岃寖鍥?-100%锛夛細
- left: 鍖哄煙宸﹁竟缂樿窛绂诲浘鐗囧乏杈圭紭鐨勭櫨鍒嗘瘮
- top: 鍖哄煙涓婅竟缂樿窛绂诲浘鐗囦笂杈圭紭鐨勭櫨鍒嗘瘮  
- right: 鍖哄煙鍙宠竟缂樿窛绂诲浘鐗囧乏杈圭紭鐨勭櫨鍒嗘瘮
- bottom: 鍖哄煙涓嬭竟缂樿窛绂诲浘鐗囦笂杈圭紭鐨勭櫨鍒嗘瘮
- width_percent: 鍖哄煙瀹藉害鍗犲浘鐗囧搴︾殑鐧惧垎姣?- height_percent: 鍖哄煙楂樺害鍗犲浘鐗囬珮搴︾殑鐧惧垎姣?
渚嬪锛歭eft=10 琛ㄧず鍖哄煙浠庡浘鐗囧乏渚?0%鐨勪綅缃紑濮嬨€?"""
    
    prompt = f"""\
浣犳槸涓€浣嶄笓涓氱殑鍥惧儚淇涓撳銆傝繖寮爌pt椤甸潰鍥剧墖鍒氬垰缁忚繃浜嗘枃瀛?瀵硅薄鎶归櫎鎿嶄綔锛屾姽闄ゅ伐鍏峰湪鎸囧畾鍖哄煙鐣欎笅浜嗕竴浜涗慨澶嶇棔杩癸紝鍖呮嫭锛?- 鑹插潡涓嶅潎鍖€銆侀鑹蹭笉杩炶疮
- 妯＄硦鐨勬枒鍧楁垨娑傛姽鐥曡抗
- 涓庡懆鍥磋儗鏅笉鍗忚皟鐨勫尯鍩燂紝姣斿涓嶅拰璋愮殑娓愬彉鑹插潡
- 鍙兘鐨勭汗鐞嗘柇瑁傛垨鍥炬涓嶈繛缁?{regions_info}
浣犵殑浠诲姟鏄慨澶嶈繖浜涙姽闄ょ棔杩癸紝璁╁浘鐗囩湅璧锋潵鍍忎粠鏈湁杩囧璞℃姽闄ゆ搷浣滀竴鏍疯嚜鐒躲€?
瑕佹眰锛?- **閲嶇偣淇涓婅堪鏍囨敞鐨勫尯鍩?*锛氳繖浜涘尯鍩熷垰鍒氱粡杩囨姽闄ゅ鐞嗭紝闇€瑕佽瀹冧滑涓庡懆鍥磋儗鏅畬缇庤瀺鍚?- 淇濇寔绾圭悊銆侀鑹层€佸浘妗堢殑杩炵画鎬?- 鎻愬崌鏁翠綋鐢昏川锛屾秷闄ゆā绯娿€佸櫔鐐广€佷吉褰?- 淇濇寔鍥剧墖鐨勫師濮嬫瀯鍥俱€佸竷灞€銆佽壊璋冮鏍?- 绂佹娣诲姞浠讳綍鏂囧瓧銆佸浘琛ㄣ€佹彃鐢汇€佸浘妗堛€佽竟妗嗙瓑鍏冪礌
- 闄や簡涓婅堪鍖哄煙锛屽叾浠栧尯鍩熶笉瑕佸仛浠讳綍淇敼锛屼繚鎸佸拰鍘熷浘鍍忕礌绾у埆鍦颁竴鑷淬€?- 杈撳嚭鍥剧墖鐨勫昂瀵稿繀椤讳笌鍘熷浘涓€鑷?
璇疯緭鍑轰慨澶嶅悗鐨勯珮娓卲pt椤甸潰鑳屾櫙鍥剧墖锛屼笉瑕侀仐婕忎慨澶嶄换浣曚竴涓娑傛姽鐨勫尯鍩熴€?"""
#     prompt = f"""
# 浣犳槸涓€浣嶄笓涓氱殑鍥惧儚淇涓撳銆傝浣犱慨澶嶄笂浼犵殑鍥惧儚锛屽幓闄ゅ叾涓殑娑傛姽鐥曡抗锛屾秷闄ゆ墍鏈夌殑妯＄硦銆佸櫔鐐广€佷吉褰憋紝杈撳嚭澶勭悊鍚庣殑楂樻竻鍥惧儚锛屽叾浠栧尯鍩熶繚鎸佸拰鍘熷浘**瀹屽叏鐩稿悓**锛岄鑹层€佸竷灞€銆佺嚎鏉°€佽楗伴渶瑕佸畬鍏ㄤ竴鑷?
# {regions_info}
# """
    return prompt


def get_ppt_page_content_extraction_prompt(markdown_text: str, language: str = None) -> str:
    """
    浠?fileparser 瑙ｆ瀽鍑虹殑 markdown 鏂囨湰涓彁鍙栭〉闈㈠唴瀹癸紙title, points, description锛?
    Args:
        markdown_text: 鍗曢〉 PDF 瑙ｆ瀽鍑虹殑 markdown 鏂囨湰
        language: 杈撳嚭璇█

    Returns:
        鏍煎紡鍖栧悗鐨?prompt 瀛楃涓?    """
    prompt = f"""\
You are a helpful assistant that extracts structured PPT page content from parsed document text.

The following markdown text was extracted from a single PPT slide:

<slide_content>
{markdown_text}
</slide_content>

Your task is to extract the following structured information from this slide:

1. **title**: The main title/heading of the slide
2. **points**: A list of key bullet points or content items on the slide
3. **description**: A complete page description suitable for regenerating this slide, following this format:

椤甸潰鏍囬锛歔title]

椤甸潰鏂囧瓧锛?- [point 1]
- [point 2]
...

鍏朵粬椤甸潰绱犳潗锛堝鏋滄湁鍥捐〃銆佽〃鏍笺€佸叕寮忕瓑鎻忚堪锛屼繚鐣欏師鏂囦腑鐨刴arkdown鍥剧墖瀹屾暣褰㈠紡锛?
Rules:
- Extract the title faithfully from the first heading in the markdown. Do NOT invent or rephrase it
- Points must be extracted verbatim from the slide content, in their original order
- In the description, 椤甸潰鏍囬 and 椤甸潰鏂囧瓧 must be copied verbatim from the original text (punctuation may be normalized, but wording must be identical)
- The description should capture ALL content on the slide including text, data, and visual element descriptions
- If there are tables, charts, or formulas, describe them in the description under "鍏朵粬椤甸潰绱犳潗"
- Preserve the original language of the content

Return a JSON object with exactly these three fields: "title", "points" (array of strings), "description" (string).
Return only the JSON, no other text.
{get_language_instruction(language)}
"""
    logger.debug(f"[get_ppt_page_content_extraction_prompt] Final prompt:\n{prompt}")
    return prompt


def get_layout_caption_prompt() -> str:
    """
    鎻忚堪 PPT 椤甸潰鐨勬帓鐗堝竷灞€锛堢粰 caption model 鐢級

    Returns:
        鏍煎紡鍖栧悗鐨?prompt 瀛楃涓?    """
    prompt = """\
You are a professional PPT layout analyst. Describe the visual layout and composition of this PPT slide image in detail.

Focus on:
1. **Overall layout**: How elements are arranged (e.g., title at top, content in two columns, image on the right)
2. **Text placement**: Where text blocks are positioned, their relative sizes, alignment
3. **Visual elements**: Position and size of images, charts, icons, decorative elements
4. **Spacing and proportions**: How space is distributed between elements

Output a concise layout description in Chinese that can be used to recreate a similar layout. Format:
