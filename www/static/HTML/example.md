: """<p class="PS" search_id="Letters on Yoga - III - 151">It is indeed needed we persevere.</p>
<p class="Q" search_id="Letters on Yoga - III - 152">At first the peace and calm are not continuous.</p>
<p class="sec-br">*</p>
<p class="P" search_id="Letters on Yoga - III - 153">These are the conditions in which one can grow through all experiences with security and</p>
<p class="p-num">Page 46</p>
<p class="PE">have the right development of the complete realisation without disturbance to the system or being carried away by the intensity of the experiences.</p>
<p class="sec-br">*</p>"""
<p class="P" search_id="Letters on Yoga - III - 153">Integral yoga</p>
<p class="P" search_id="Letters on Yoga - III - 153">Love is great</p>


So first "P" will be concatenanted with "PE" in downward scan (ignoring p-num and ignoring sec-br)
Then "P + PE" will be concatenanted with "Q" and "PS" ("PS" + \n\n + "Q" + \n\n + "P" + "PE"). This whole thing will be one json line in the index and given one search_id

The second "P" (Integral Yoga) will be a separate indexed entry with separate search_id