<?xml version="1.0" ?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0"
  xmlns="http://www.w3.org/1999/xhtml"
  >
  <!-- saxon-js doesn't like 'version="1.0"' -->
  <xsl:output method="html" encoding="utf-8" indent="yes"/>

  <xsl:template match="node()|@*">
    <xsl:copy>
      <xsl:apply-templates select="node()|@*"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="@data-idx">
    <xsl:variable name="n"><xsl:number level="any" from="*[contains(@class, 'is-word')]" count="*[contains(@class, 'is-word')]//span[@data-idx]"/></xsl:variable>
    <xsl:attribute name="data-idx"><xsl:value-of select="$n - 1"/></xsl:attribute>
  </xsl:template>

</xsl:stylesheet>
