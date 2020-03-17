# Integrere kommunikasjon med ePost

[ePost](https://www.emit.no/product/epost-med-diode-421) bruker radio for
kommunikasjon, det skal muligens ikke være så vanskelige å reverse engineere. Se
guide
["RF reverse engineering has become trivial"](https://medium.com/@nihal.pasham/rf-reverse-engineering-has-become-trivial-thanks-to-the-opensource-sdr-movement-d1f9216f2f04)

Jeg har til rådighet
["RTL 820T2 SDR Dongle"](https://www.hamgoodies.co.uk/rtl-sdr-dongle), som er
brukt i guiden.

Tanken er at om jeg finner ut kommunikasjonsprotokollen til ePost, kan man lage
en liten vanntett arduino/raspberry PI device som er i nærheten av sisteposten
(som da er en ePost), og at man kan logge alle som er kommet i mål. Så om noen
glemmer å gå til registrering så vil det likevel være mulig å hente de ut. Dette
vil potensielt også kunne fungere som en backup, og ikke minst vil dette kunne
fungere som en utlesningsmekanisme i seg selv (man kunne hatt ePost-enheten
liggende ved siden av datamaskinen, ingen kabler!).
