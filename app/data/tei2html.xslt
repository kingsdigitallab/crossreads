<?xml version="1.0" ?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0"
  xmlns="http://www.w3.org/1999/xhtml"
  >
  <!-- saxon-js doesn't like 'version="1.0"' -->
  <xsl:output method="html" encoding="utf-8" indent="yes"/>
  
  <xsl:template match="/">
    <xsl:apply-templates select="//tei:text/tei:body/tei:div[@type='edition'][not(@subtype='transliteration')]"/>
  </xsl:template>

  <xsl:template match="comment()">
  </xsl:template>

  <xsl:template match="*">
      <xsl:call-template name="lossless-span"/>
  </xsl:template>

  <xsl:template match="tei:p|tei:div">
    <xsl:element name="{local-name()}">
      <xsl:call-template name="lossless-attributes"/>
      <xsl:apply-templates />
    </xsl:element>
  </xsl:template>

  <xsl:template match="tei:lb">
    <br>
      <xsl:call-template name="lossless-attributes"/>
    </br>
    <span class="line-number"><xsl:number level="any" count="tei:lb"/></span>
  </xsl:template>

  <!-- <xsl:template match="tei:ex">
  </xsl:template> -->

  <xsl:template name="lossless-span">
    <span>
      <xsl:call-template name="lossless-attributes"/>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template name="lossless-div">
    <div>
      <xsl:call-template name="lossless-attributes"/>
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template name="lossless-attributes">
    <xsl:attribute name="class">
      <xsl:value-of select="concat('tei-', local-name())"/>
      <xsl:if test="@type"> tei-type-<xsl:value-of select="@type"/></xsl:if>
      <xsl:if test="local-name() = 'w' or local-name() = 'name' or local-name() = 'g' or local-name() = 'placeName' or local-name() = 'num' or local-name() = 'orgName' or local-name()='orig'"> is-word</xsl:if>
    </xsl:attribute>
    <xsl:attribute name="data-tei"><xsl:value-of select="local-name()" /></xsl:attribute>
    <!-- (tei:w|tei:name|tei:num) -->
    <xsl:apply-templates select="@*" mode="data-tei" />
  </xsl:template> 

  <xsl:template match="@*" mode="data-tei">
    <xsl:attribute name="{concat('data-tei-', local-name())}"><xsl:value-of select="." /></xsl:attribute>
  </xsl:template>

  <xsl:template match="tei:w//text()|tei:name//text()|tei:g//text()|tei:placeName//text()|tei:num//text()|tei:orgName//text()|tei:orig//text()">
    <xsl:call-template name="mark-up-every-character">
      <xsl:with-param name="text" select="."/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="mark-up-every-character">
    <xsl:param name="text"/>
    <xsl:choose>
      <xsl:when test="normalize-space(substring($text, 1, 1)) = ''">
        <span><xsl:text>&#160;</xsl:text></span>
      </xsl:when>
      <xsl:otherwise>
        <span class="sign" data-idx="0"><xsl:value-of select="substring($text, 1, 1)"/></span>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:if test="string-length($text) > 1">
      <xsl:call-template name="mark-up-every-character">
        <xsl:with-param name="text" select="substring($text, 2, string-length($text) - 1)"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
